// ERKAM — Emanet ve Hukuk metinleri. Metin değişirse SURUM artırılır; yoldaşlardan yeniden onay istenir.
(function () {
  var SORUMLU = 'Sadullah Akça';
  var EPOSTA = 'erkamsocialmedya@gmail.com';
  var TARIH = '11 Kasım 2026';

  window.HUKUK = {
    surum: 1,
    tarih: TARIH,
    sorumlu: SORUMLU,
    eposta: EPOSTA,
    metinler: {
      // ---------------------------------------------------------------
      aydinlatma: {
        baslik: 'KVKK Aydınlatma Metni',
        ikon: 'script-text-outline',
        ozet: '6698 sayılı Kişisel Verilerin Korunması Kanunu\'nun 10. maddesi uyarınca; verilerini kimin, hangi amaçla, hangi hukuki sebeple işlediğini ve haklarını anlatır.',
        bolumler: [
          ['1. Veri Sorumlusu',
            'ERKAM uygulaması ("ERKAM" veya "Meclis"), gerçek kişi veri sorumlusu ' + SORUMLU + ' tarafından gönüllü ve ticari olmayan bir topluluk hizmeti olarak işletilmektedir. Kişisel verilerinle ilgili her konuda ' + EPOSTA + ' adresinden ya da uygulama içindeki Nizam › Emanet ve Hukuk › KVKK Başvurusu bölümünden bize ulaşabilirsin.'],
          ['2. İşlenen Kişisel Veriler',
            '• Kimlik ve hesap bilgileri: isim soyisim, künye (kullanıcı adı), e-posta adresi, şifrenin geri döndürülemez biçimde şifrelenmiş hâli, doğum tarihi.\n' +
            '• Profil bilgileri: profil ve kapak fotoğrafı, biyografi, gizli hesap tercihi.\n' +
            '• Paylaşım ve etkileşim verileri: kelamlar, cevaplar, eklediğin fotoğraf ve videolar, mühürler (#etiketler), tasdikler, heyben, yoldaşlıkların, birebir mesajların, şikâyetlerin, Suffe ders ilerlemen.\n' +
            '• Teknik veriler: bildirim gönderebilmek için cihazına özgü bildirim anahtarı, oturum anahtarları, giriş zamanları ve hizmet sağlayıcılarımızın güvenlik amacıyla tuttuğu IP adresi ve erişim kayıtları.\n' +
            '• Talep verileri: KVKK başvuruların ve bunlara verilen cevaplar, onay kayıtların (hangi metin sürümünü ne zaman onayladığın).\n\n' +
            'ERKAM; konumunu, rehberini, arama ve SMS kayıtlarını, mikrofon kaydını ve reklam kimliğini TOPLAMAZ. Kamera ve galeriye yalnızca sen bir fotoğraf ya da video seçtiğinde, o dosya için erişilir.'],
          ['3. İşleme Amaçları',
            '• Üyeliğinin oluşturulması, e-posta tasdiki, girişin ve şifre yenilemenin yapılması,\n' +
            '• Kelam, mesaj ve fotoğraf paylaşma, yoldaş edinme gibi uygulama işlevlerinin sunulması,\n' +
            '• Sana bildirim (ulak) gönderilmesi,\n' +
            '• Yasal yaş sınırına uyulması ve 18 yaşından küçük yoldaşlar için korumalı hizmet sunulması,\n' +
            '• Meclis güvenliğinin sağlanması; şikâyetlerin incelenmesi, kurallara aykırı içerik ve hesaplara karşı tedbir alınması, kötüye kullanım ve dolandırıcılığın önlenmesi,\n' +
            '• 5651 sayılı Kanun başta olmak üzere mevzuattan doğan yükümlülüklerin yerine getirilmesi ve yetkili makamların hukuka uygun taleplerinin karşılanması,\n' +
            '• Olası uyuşmazlıklarda hakların tesisi, kullanılması ve korunması,\n' +
            '• KVKK başvurularının cevaplanması.\n\n' +
            'Verilerin hiçbir şekilde satılmaz, kiralanmaz, reklam veya profilleme amacıyla kullanılmaz.'],
          ['4. Hukuki Sebepler (KVKK m.5 ve m.6)',
            '• Üyelik sözleşmesinin kurulması ve ifası için zorunlu olması (m.5/2-c): hesap, profil, paylaşım ve mesaj verileri.\n' +
            '• Veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi (m.5/2-ç): yaş sınırı, erişim kayıtları, makam talepleri.\n' +
            '• Bir hakkın tesisi, kullanılması veya korunması (m.5/2-e): onay kayıtları, şikâyet ve yaptırım kayıtları.\n' +
            '• Temel hak ve özgürlüklerine zarar vermemek kaydıyla meşru menfaat (m.5/2-f): Meclis güvenliği ve kötüye kullanımın önlenmesi.\n' +
            '• Kendi paylaşımlarında dinî, felsefî veya başka özel nitelikli bilgileri kendi isteğinle açıklarsan bu bilgiler, KVKK m.6 uyarınca senin alenileştirdiğin ve alenileştirme iradene uygun olarak işlenir. Bu tür bilgileri paylaşmak zorunda değilsin.'],
          ['5. Aktarım ve Yurt Dışı',
            'Verilerin, hizmetin sunulması için zorunlu olan ölçüde aşağıdaki hizmet sağlayıcılarına (veri işleyen) aktarılır:\n' +
            '• Supabase Inc. — veritabanı, kimlik doğrulama ve dosya depolama; sunucular Frankfurt / Almanya (Avrupa Birliği).\n' +
            '• Google LLC (Firebase Cloud Messaging ve Gmail) — bildirim ve e-posta gönderimi.\n' +
            '• GitHub Inc. — uygulama güncellemelerinin indirilmesi (yalnızca teknik bağlantı bilgisi).\n\n' +
            'Bu aktarımlar yurt dışına aktarım niteliğindedir ve KVKK m.9\'da öngörülen usul ve güvencelere uygun olarak yapılır. Ayrıca kanunen yetkili kamu kurum ve kuruluşları ile adli makamlara, yalnızca hukuka uygun bir talep olduğunda ve talep edilen ölçüde aktarım yapılabilir.'],
          ['6. Toplama Yöntemi',
            'Verilerin; kayıt formu, profil düzenleme, paylaşım ve mesaj ekranları gibi uygulama içi elektronik formlar aracılığıyla doğrudan senden, teknik veriler ise uygulamanın çalışması sırasında otomatik yollarla toplanır.'],
          ['7. Saklama Süresi',
            '• Hesap, profil, paylaşım ve mesaj verilerin hesabın açık kaldığı sürece saklanır. Hesabını sildiğinde bu veriler derhâl ve kalıcı olarak silinir. Karşı tarafa gönderdiğin mesajlar da bu kapsamda silinir.\n' +
            '• Fotoğraf ve videolar, bağlı oldukları içerik silindikten sonra yapılan ilk depo temizliğinde silinir.\n' +
            '• Erişim ve güvenlik kayıtları, mevzuatın öngördüğü süre boyunca saklanır.\n' +
            '• Onay kayıtları, ispat amacıyla ve kimliğinle eşleşmeyecek biçimde saklanmaya devam eder.\n' +
            '• Süresi dolan veriler silinir, yok edilir veya anonim hâle getirilir.'],
          ['8. Hakların (KVKK m.11)',
            'Veri sorumlusuna başvurarak:\n' +
            'a) Kişisel verinin işlenip işlenmediğini öğrenme,\nb) İşlenmişse buna ilişkin bilgi talep etme,\nc) İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,\n' +
            'ç) Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,\nd) Eksik veya yanlış işlenmişse düzeltilmesini isteme,\n' +
            'e) KVKK m.7 çerçevesinde silinmesini veya yok edilmesini isteme,\nf) (d) ve (e) bentlerindeki işlemlerin, verinin aktarıldığı üçüncü kişilere bildirilmesini isteme,\n' +
            'g) Münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhine bir sonucun ortaya çıkmasına itiraz etme,\n' +
            'ğ) Kanuna aykırı işleme sebebiyle zarara uğraman hâlinde zararın giderilmesini talep etme haklarına sahipsin.\n\n' +
            'Uygulama içinden verilerinin tamamını tek dosya hâlinde indirebilir, profilini düzeltebilir ve hesabını kendin silebilirsin.'],
          ['9. Başvuru Yolu',
            'Başvurunu uygulama içindeki KVKK Başvurusu formuyla ya da ERKAM\'a kayıtlı e-posta adresinden ' + EPOSTA + ' adresine yazarak iletebilirsin. Başvurun en geç otuz gün içinde ücretsiz olarak sonuçlandırılır. Başvurunun reddedilmesi, cevabın yetersiz bulunması veya süresinde cevap verilmemesi hâlinde Kişisel Verileri Koruma Kurulu\'na şikâyette bulunabilirsin.']
        ]
      },
      // ---------------------------------------------------------------
      gizlilik: {
        baslik: 'Gizlilik Politikası',
        ikon: 'lock-outline',
        ozet: 'Verilerini nasıl koruduğumuzu, neyi görüp neyi görmediğimizi sade bir dille anlatır.',
        bolumler: [
          ['Emanet anlayışımız',
            'Adımızı aldığımız Dârü\'l-Erkam, yoldaşların emniyet içinde toplandığı bir evdi. Biz de verilerini bir emanet olarak görüyoruz: Hizmeti sunmak için gerekenden fazlasını istemiyor, kimseye satmıyor, reklam için kullanmıyoruz.'],
          ['Kim neyi görür?',
            '• Herkes: isim, künye, profil fotoğrafı, biyografi ve kelamların. Gizli hesap (İzole Kimlik) açıksa profilini ve kelamlarını yalnızca onayladığın yoldaşların görür.\n' +
            '• Yalnızca sen ve karşındaki: birebir mesajlar.\n' +
            '• Hiçbir yoldaş göremez: e-posta adresin, doğum tarihin, şifren.\n' +
            '• Yönetim: Meclis güvenliği için şikâyet edilen içerikleri, hesap bilgilerini ve gerektiğinde ilgili kayıtları görebilir. Yönetimin mesaj içeriklerine erişimi yalnızca şikâyet, hukuki zorunluluk veya güvenlik tehdidi hâlleriyle sınırlıdır.'],
          ['Uygulama izinleri',
            '• Bildirim: ulak bildirimleri için; Nizam\'dan istediğin an kapatabilirsin.\n' +
            '• Fotoğraf ve video: yalnızca senin seçtiğin dosya için.\n' +
            '• Uygulama yükleme: yalnızca ERKAM güncellemelerini kurmak için.\n' +
            '• Biyometrik: parmak izin ya da yüzün telefonunda kalır, bize hiçbir zaman ulaşmaz.'],
          ['Güvenlik tedbirleri',
            'Bağlantılar şifreli (HTTPS/TLS) yapılır. Şifren geri döndürülemez biçimde saklanır, kimse —yönetim dâhil— şifreni göremez. Veritabanında her yoldaş yalnızca kendisine izin verilen veriye erişebilir (satır düzeyinde güvenlik). Yönetim yetkisi sınırlı sayıda kişiye verilir. Yine de internet üzerinden yapılan hiçbir aktarımın mutlak güvenli olmadığını hatırlatırız. Bir güvenlik ihlali olursa ilgili yoldaşlara ve mevzuatın gerektirdiği hâllerde Kişisel Verileri Koruma Kurulu\'na en kısa sürede bildirim yapılır.'],
          ['Çerez ve takip',
            'ERKAM reklam çerezi, izleme pikseli veya üçüncü taraf analiz aracı kullanmaz. Telefonunda yalnızca oturumunu ve tema, bildirim gibi tercihlerini hatırlayan küçük kayıtlar tutulur.'],
          ['Gençlerin korunması',
            '15 yaşını doldurmamış kişiler ERKAM\'a üye olamaz. 15–18 yaş arasındaki yoldaşların hesabı varsayılan olarak gizli açılır, verileri hiçbir koşulda profilleme veya reklam amacıyla kullanılmaz. Yaşına uygun olmayan bir hesap fark edersen şikâyet etmeni rica ederiz.'],
          ['Hesabını silmek',
            'Nizam › Hesabımı Kalıcı Olarak Sil ile hesabını, kelamlarını, mesajlarını, heybeni ve yoldaşlıklarını tek dokunuşla silebilirsin. Silmeden önce verilerini indirebilirsin.'],
          ['Değişiklikler',
            'Bu politika değişirse uygulama içinde bildirilir. Önemli değişikliklerde ERKAM\'ı kullanmaya devam etmeden önce senden yeniden onay istenir.']
        ]
      },
      // ---------------------------------------------------------------
      sartlar: {
        baslik: 'Kullanım Şartları',
        ikon: 'scale-balance',
        ozet: 'ERKAM ile yoldaş arasındaki üyelik sözleşmesidir. Kaydolarak ve onay vererek bu şartları kabul etmiş olursun.',
        bolumler: [
          ['1. Taraflar ve Konu',
            'Bu sözleşme; ERKAM uygulamasını işleten ' + SORUMLU + ' ("ERKAM") ile uygulamaya üye olan kişi ("Yoldaş") arasında, uygulamanın kullanım şartlarını belirlemek amacıyla kurulmuştur.'],
          ['2. Hizmetin Niteliği',
            'ERKAM; kelam paylaşma, mesajlaşma, ders (Suffe) ve topluluk işlevleri sunan, ücretsiz ve gönüllü olarak işletilen bir sosyal ağdır. ERKAM, hizmetin içeriğini, işlevlerini ve tasarımını önceden haber vermeksizin değiştirme, geçici veya kalıcı olarak durdurma hakkını saklı tutar.'],
          ['3. Üyelik Şartları',
            '• Üye olmak için 15 yaşını doldurmuş olmak gerekir. 15–18 yaş arasındaki yoldaşlar korumalı (ayrıştırılmış) hizmetten yararlanır.\n' +
            '• Yoldaş, kayıt sırasında verdiği bilgilerin (özellikle doğum tarihinin) doğru olduğunu kabul eder. Yanlış beyandan doğan sorumluluk yoldaşa aittir.\n' +
            '• Mevzuat gereği yaş doğrulaması (ör. e-Devlet yaş doğrulama belirteci) istenebilir; doğrulama yapılmayan veya yaş şartını karşılamayan hesaplar askıya alınabilir veya kapatılabilir.\n' +
            '• Başka bir kişiyi, kurumu veya ERKAM yönetimini taklit eden ya da yanıltıcı künye ve isimler kullanılamaz.'],
          ['4. Hesap Güvenliği',
            'Şifrenin ve hesabının güvenliğinden yoldaş sorumludur. Hesap üzerinden yapılan işlemler hesap sahibine ait sayılır. Yetkisiz bir kullanım fark edersen şifreni hemen değiştirmeli ve ERKAM\'a bildirmelisin.'],
          ['5. İçerik ve Sorumluluk',
            '• Yoldaş, paylaştığı her türlü içerikten (metin, fotoğraf, video, mesaj) bizzat ve münhasıran sorumludur; 5651 sayılı Kanun bakımından içerik sağlayıcı yoldaşın kendisidir.\n' +
            '• ERKAM, 5651 sayılı Kanun kapsamında yer sağlayıcı konumundadır. ERKAM, yer sağladığı içerikleri önceden kontrol etmek veya hukuka aykırılık araştırmakla yükümlü değildir. Hukuka aykırı içerik usulüne uygun biçimde bildirildiğinde veya fark edildiğinde, içerik yayından kaldırılır.\n' +
            '• Yoldaşların paylaşımları ERKAM\'ın görüşünü yansıtmaz.'],
          ['6. İçerik Üzerindeki Haklar',
            'Paylaştığın içeriğin hakları sende kalır. Paylaşarak ERKAM\'a, bu içeriği yalnızca hizmetin sunulması amacıyla saklama, görüntüleme, yedekleme, boyutlandırma ve yoldaşlara gösterme yetkisini ücretsiz ve münhasır olmayan biçimde vermiş olursun. Bu yetki, içeriği veya hesabını sildiğinde sona erer. Başkasına ait fikrî hakları ihlal eden içerik paylaşamazsın.'],
          ['7. Yasak Davranışlar',
            'Topluluk Nizamı\'nda sayılanlara ek olarak; hukuka, genel ahlaka ve kişilik haklarına aykırı içerik paylaşmak; hakaret, tehdit, taciz, nefret söylemi; müstehcenlik; şiddet ve terörü övmek; dolandırıcılık, spam ve izinsiz reklam; başkasının kişisel verilerini paylaşmak; zararlı yazılım yaymak; sisteme yetkisiz erişmeye, açıkları istismar etmeye veya hizmeti aksatmaya çalışmak; otomatik araçlarla veri toplamak ve sahte hesap açmak yasaktır.'],
          ['8. Yönetimin Yetkileri',
            'ERKAM yönetimi; bu şartlara, Topluluk Nizamı\'na veya mevzuata aykırılık gördüğünde veya böyle bir şüphe olduğunda, kendi takdirine göre ve önceden bildirim yapmaksızın içeriği kaldırabilir, yoldaşı belirli bir süre susturabilir, hesabı askıya alabilir veya Meclisten kalıcı olarak uzaklaştırabilir. Onay rozeti ve yönetim yetkisi ERKAM\'ın takdirindedir; talep edilerek hak olarak kazanılmaz.'],
          ['9. Sorumluluğun Sınırlandırılması',
            'Hizmet "olduğu gibi" ve "mümkün olduğu ölçüde" sunulur. ERKAM; hizmetin kesintisiz veya hatasız olacağını, içeriklerin doğru veya güncel olacağını taahhüt etmez. Yoldaşlar arasındaki ilişkilerden, yoldaşların içerik ve davranışlarından, üçüncü taraf bağlantılarından, teknik arıza, bakım, mücbir sebep veya hizmet sağlayıcılardan kaynaklanan kesinti ve veri kayıplarından ERKAM sorumlu tutulamaz. Bu sınırlama, kanunen sorumluluğun kaldırılamadığı kast ve ağır ihmal hâllerini kapsamaz.'],
          ['10. Tazmin',
            'Yoldaşın bu şartları veya mevzuatı ihlal etmesi nedeniyle ERKAM\'a karşı üçüncü kişilerce veya kamu makamlarınca bir talepte bulunulması hâlinde, bu talepten doğan her türlü zarar, ceza ve masraf (makul avukatlık ücreti dâhil) ihlali yapan yoldaş tarafından karşılanır.'],
          ['11. Fikrî Mülkiyet',
            'ERKAM adı, hilal-yıldız logosu, arayüz tasarımı ve yazılım üzerindeki haklar ERKAM\'a aittir; izinsiz kopyalanamaz ve taklit edilemez.'],
          ['12. Yetkili Makamlarla İş Birliği',
            'ERKAM; mahkemeler, savcılıklar ve kanunen yetkili diğer makamlardan gelen hukuka uygun taleplere, mevzuatın gerektirdiği ölçüde bilgi vererek iş birliği yapar.'],
          ['13. Delil Sözleşmesi',
            'Taraflar, bu sözleşmeden doğabilecek uyuşmazlıklarda ERKAM\'ın sunucu kayıtları, veritabanı ve onay kayıtlarının 6100 sayılı Hukuk Muhakemeleri Kanunu\'nun 193. maddesi uyarınca geçerli ve kesin delil teşkil edeceğini kabul eder.'],
          ['14. Değişiklikler ve Sona Erme',
            'ERKAM bu şartları güncelleyebilir; güncelleme uygulama içinde duyurulur ve önemli değişikliklerde yeniden onay istenir. Yoldaş, hesabını dilediği an silerek sözleşmeyi sona erdirebilir. ERKAM, 8. madde kapsamındaki hâllerde sözleşmeyi tek taraflı olarak sona erdirebilir.'],
          ['15. Uygulanacak Hukuk',
            'Bu sözleşme Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda Türkiye Cumhuriyeti mahkemeleri ve icra daireleri yetkilidir.'],
          ['16. İletişim',
            'Sorular ve bildirimler için: ' + EPOSTA]
        ]
      },
      // ---------------------------------------------------------------
      nizam: {
        baslik: 'Topluluk Nizamı',
        ikon: 'handshake-outline',
        ozet: 'Meclisin edep kuralları. Her yoldaş bu kurallara riayet etmeyi kabul eder.',
        bolumler: [
          ['1. Edep ve üslup',
            'Hiçbir yoldaşa hakaret edilmez, alay edilmez, aşağılanmaz. Fikre fikirle cevap verilir; kişiye değil, söze itiraz edilir.'],
          ['2. Mahremiyet',
            'Başkasının fotoğrafı, telefonu, adresi, özel mesajı ve sırrı izinsiz paylaşılmaz. Ekran görüntüsüyle ifşa yapılmaz.'],
          ['3. Doğruluk',
            'Bilerek yalan haber, sahte bilgi ve iftira yayılmaz. Kaynağı belirsiz iddiaları yaymadan önce tahkik et.'],
          ['4. Temiz içerik',
            'Müstehcen, şiddet içeren, korkutucu veya tiksindirici içerik paylaşılmaz. Kumar, uyuşturucu, silah ticareti ve yasa dışı her türlü faaliyetin reklamı yapılmaz.'],
          ['5. Ayrımcılığa ve nefrete yer yok',
            'Hiç kimse ırkı, dili, cinsiyeti, engeli veya inancı sebebiyle hedef alınmaz. Fitne çıkarmak, kin ve nefret aşılamak yasaktır.'],
          ['6. Güvenlik',
            'Kimsenin hesabına, cihazına veya sistemine izinsiz girilmez. Öğrenilen güvenlik bilgisi yalnızca korumak için kullanılır. Bir açık bulursan yönetime bildir.'],
          ['7. Ticaret ve spam',
            'İzinsiz reklam, zincir mesaj, toplu etiketleme ve dolandırıcılık yasaktır.'],
          ['8. Şikâyet ve yaptırım',
            'Kurala aykırı bir kelam gördüğünde kelamın menüsünden şikâyet et. Yönetim, ihlalin ağırlığına göre sırasıyla uyarı, içeriğin kaldırılması, belirli süre susturma ve Meclisten uzaklaştırma tedbirlerini uygular. Ağır ihlallerde bu sıra beklenmez.']
        ]
      }
    }
  };
})();
