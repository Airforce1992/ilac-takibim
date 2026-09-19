# Sağlık Cepte – iPhone HealthKit companion (ilk sürüm)

Bu klasör, **yerel bir iOS uygulamasının kaynak kodudur**. Mevcut GitHub Pages web uygulamasını veya ilaç kayıtlarını değiştirmez. iPhone'da Apple Sağlık erişim izni verildiğinde kayıtlı kalp atım hızı, adım sayısı, uyku süresi, kandaki oksijen ve bilek sıcaklığı kayıtlarını HealthKit üzerinden okur, iPhone uygulamasında gösterir. Erişim verilmeyen, desteklenmeyen veya henüz kaydedilmemiş ölçümler için değer uydurmaz. Açılışta ve uygulama öne geldiğinde yeniden okur; uygulama açıkken HealthKit değişikliklerini gözlemler. Arka planda kesintisiz/garantili aktarım sağlamaz.

**Henüz yok:** Sağlık Cepte web sayfasına otomatik aktarım, sunucu senkronizasyonu, ilaç verilerinin iki yönde eşitlenmesi, saatten doz işaretleme, Apple Watch için ayrı bir uygulama. Bunlar için güvenli kullanıcı hesabı, açık rıza, eşitleme servisi ve ayrı geliştirme gerekir. Sağlık verileri bu ilk sürümde sunucuya gönderilmez.

## Derleme ve kurulum

1. Bir Mac veya yetkili macOS bulut derleme ortamında Xcode ve [XcodeGen](https://github.com/yonaskolb/XcodeGen) kur.
2. Bu klasörde `xcodegen generate` çalıştır ve `SaglikCepteHealth.xcodeproj` projesini Xcode'da aç.
3. Apple Developer takımını, benzersiz bundle ID'yi ve HealthKit yetkisine sahip imzalama profilini ayarla. Gerçek iPhone üzerinde kullanım ve dağıtım için Apple'ın kod imzalama/dağıtım gereksinimlerini karşıla. GitHub Pages sitesi bir iOS uygulaması kuramaz.
4. iPhone'da uygulamayı aç; Apple Sağlık okuma izinlerini açıkça ver. Apple Watch verilerinin iPhone'daki Sağlık uygulamasında bulunması gerekir.

`NSHealthShareUsageDescription` ve HealthKit entitlement yapılandırmaları `project.yml` ve `HealthCompanion.entitlements` içindedir. Bu bir tıbbi tanı veya tedavi uygulaması değildir. Bilgiler cihazdaki Sağlık kaydından gelir; yeni ölçüm gelene kadar son kayıt güncel değildir.

## Güvenlik ve veri modeli

Bu başlangıç uygulaması HealthKit verilerini sadece cihazda bellek içinde görüntüler; internet ile senkronize etmez. Sunucuya veri göndermeden önce güvenli kimlik doğrulama, ayrıntılı izin ekranı, veri saklama/silme kuralları ve aktarım kapsamı ayrıca hazırlanmalıdır.
