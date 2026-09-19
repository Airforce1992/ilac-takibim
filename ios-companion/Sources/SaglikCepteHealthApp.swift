import SwiftUI
import HealthKit

@main
struct SaglikCepteHealthApp: App {
    @StateObject private var health = HealthReader()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            HealthDashboard()
                .environmentObject(health)
                .task { await health.refresh() }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { Task { await health.refresh() } }
                }
        }
    }
}

struct HealthReading: Identifiable {
    let id: String
    let title: String
    let value: String
    let date: Date?
    let symbol: String
}

@MainActor
final class HealthReader: ObservableObject {
    @Published var readings: [HealthReading] = []
    @Published var status = "Apple Sağlık bağlantısı için izin verin."
    @Published var loading = false
    @Published var hasRequestedAccess = false

    private let store = HKHealthStore()
    private var observers: [HKObserverQuery] = []

    private var heart: HKQuantityType { HKObjectType.quantityType(forIdentifier: .heartRate)! }
    private var steps: HKQuantityType { HKObjectType.quantityType(forIdentifier: .stepCount)! }
    private var oxygen: HKQuantityType { HKObjectType.quantityType(forIdentifier: .oxygenSaturation)! }
    private var wrist: HKQuantityType { HKObjectType.quantityType(forIdentifier: .appleSleepingWristTemperature)! }
    private var sleep: HKCategoryType { HKObjectType.categoryType(forIdentifier: .sleepAnalysis)! }

    var available: Bool { HKHealthStore.isHealthDataAvailable() }

    func requestAccess() async {
        guard available else {
            status = "Apple Sağlık bu cihazda kullanılamıyor."
            return
        }
        let types: Set<HKObjectType> = [heart, steps, oxygen, wrist, sleep]
        do {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                store.requestAuthorization(toShare: [], read: types) { ok, error in
                    if let error { continuation.resume(throwing: error) }
                    else if !ok {
                        continuation.resume(throwing: NSError(
                            domain: "SaglikCepteHealth", code: 1,
                            userInfo: [NSLocalizedDescriptionKey: "Apple Sağlık izin isteği tamamlanamadı."]
                        ))
                    } else { continuation.resume() }
                }
            }
            hasRequestedAccess = true
            status = "İzin verdiğiniz ölçümler okunuyor. Görünmeyen kayıtlar için erişim verilmemiş veya veri bulunmuyor olabilir."
            await refresh()
            startObservers()
        } catch {
            status = "Apple Sağlık izni alınamadı: \(error.localizedDescription)"
        }
    }

    func refresh() async {
        guard available else {
            status = "Apple Sağlık bu cihazda kullanılamıyor."
            return
        }
        guard !loading else { return }
        loading = true
        defer { loading = false }

        async let heartReading = latest(heart, title: "Nabız", symbol: "heart.fill",
                                        unit: HKUnit.count().unitDivided(by: .minute()), suffix: "/dk")
        async let oxygenReading = latest(oxygen, title: "Kandaki oksijen", symbol: "lungs.fill",
                                         unit: HKUnit.percent(), suffix: "%", multiplier: 100)
        async let wristReading = latest(wrist, title: "Bilek sıcaklığı", symbol: "thermometer",
                                        unit: HKUnit.degreeCelsius(), suffix: "°C")
        async let stepsReading = todaySteps()
        async let sleepReading = lastNightSleep()

        readings = await [heartReading, stepsReading, sleepReading, oxygenReading, wristReading]
        status = "Son güncelleme: \(Date.now.formatted(date: .abbreviated, time: .shortened)). Kayıtlar otomatik olarak uygulama açıldığında yenilenir."
    }

    private func latest(_ type: HKQuantityType, title: String, symbol: String,
                        unit: HKUnit, suffix: String, multiplier: Double = 1) async -> HealthReading {
        await withCheckedContinuation { continuation in
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
            let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) {
                _, samples, _ in
                guard let sample = samples?.first as? HKQuantitySample else {
                    continuation.resume(returning: .init(id: type.identifier, title: title, value: "Veri yok", date: nil, symbol: symbol))
                    return
                }
                let value = sample.quantity.doubleValue(for: unit) * multiplier
                let display = multiplier == 100 ? String(format: "%.0f", value) : String(format: "%.1f", value)
                continuation.resume(returning: .init(id: type.identifier, title: title, value: display + " " + suffix,
                                                     date: sample.endDate, symbol: symbol))
            }
            store.execute(query)
        }
    }

    private func todaySteps() async -> HealthReading {
        let start = Calendar.current.startOfDay(for: Date())
        return await withCheckedContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: Date(), options: .strictStartDate)
            let query = HKStatisticsQuery(quantityType: steps, quantitySamplePredicate: predicate, options: .cumulativeSum) {
                _, result, _ in
                guard let sum = result?.sumQuantity() else {
                    continuation.resume(returning: .init(id: "steps", title: "Bugünkü adım", value: "Veri yok",
                                                         date: nil, symbol: "figure.walk"))
                    return
                }
                let value = Int(sum.doubleValue(for: .count()))
                continuation.resume(returning: .init(id: "steps", title: "Bugünkü adım",
                                                     value: value.formatted() + " adım", date: Date(), symbol: "figure.walk"))
            }
            store.execute(query)
        }
    }

    private func lastNightSleep() async -> HealthReading {
        let since = Date().addingTimeInterval(-36 * 60 * 60)
        return await withCheckedContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: since, end: Date(), options: .strictStartDate)
            let query = HKSampleQuery(sampleType: sleep, predicate: predicate, limit: HKObjectQueryNoLimit,
                                      sortDescriptors: nil) { _, samples, _ in
                let asleep = (samples as? [HKCategorySample] ?? []).filter { sample in
                    switch sample.value {
                    case HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                         HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                         HKCategoryValueSleepAnalysis.asleepREM.rawValue,
                         HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue: return true
                    default: return false
                    }
                }
                // Health may include overlapping sleep records from different sources.
                // Present a simple estimate, not a clinical sleep report.
                let seconds = asleep.reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) }
                guard seconds > 0 else {
                    continuation.resume(returning: .init(id: "sleep", title: "Son uyku (yaklaşık)",
                                                         value: "Veri yok", date: nil, symbol: "moon.zzz.fill"))
                    return
                }
                continuation.resume(returning: .init(id: "sleep", title: "Son 36 saatte uyku (yaklaşık)",
                                                     value: String(format: "%.1f saat", seconds / 3600),
                                                     date: asleep.map(\.endDate).max(), symbol: "moon.zzz.fill"))
            }
            store.execute(query)
        }
    }

    private func startObservers() {
        guard observers.isEmpty else { return }
        for type in [heart, steps, oxygen, wrist, sleep] as [HKSampleType] {
            let query = HKObserverQuery(sampleType: type, predicate: nil) { [weak self] _, completion, _ in
                Task { @MainActor in
                    await self?.refresh()
                    completion()
                }
            }
            observers.append(query)
            store.execute(query)
        }
    }
}

struct HealthDashboard: View {
    @EnvironmentObject private var health: HealthReader

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Apple Watch Series 8", systemImage: "applewatch")
                            .font(.headline)
                        Text("Apple Sağlık'ta kayıtlı ölçümler iPhone üzerinden okunur. Veriler bu sürümde web uygulamasına veya sunucuya gönderilmez.")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 16))

                    if health.available {
                        Button("Apple Sağlık okuma izni ver") {
                            Task { await health.requestAccess() }
                        }
                        .buttonStyle(.borderedProminent)
                        Button("Ölçümleri yenile") {
                            Task { await health.refresh() }
                        }
                        .disabled(health.loading)
                    }

                    Text(health.status).font(.footnote).foregroundStyle(.secondary)

                    ForEach(health.readings) { item in
                        HStack(alignment: .center, spacing: 12) {
                            Image(systemName: item.symbol)
                                .font(.title2).frame(width: 34)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.title).font(.subheadline).foregroundStyle(.secondary)
                                Text(item.value).font(.title3.bold())
                                if let date = item.date {
                                    Text(date.formatted(date: .abbreviated, time: .shortened))
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            Spacer(minLength: 0)
                        }
                        .padding()
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
                    }
                    Text("Sağlık Cepte tıbbi değerlendirme veya ilaç kullanımı tavsiyesi vermez. Ölçümlerin kayıt zamanına bakın.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                .padding()
            }
            .navigationTitle("Sağlık Cepte")
        }
    }
}
