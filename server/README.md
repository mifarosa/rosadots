# Rosadots online sunucusu

Online oyun için oda sunucusu. Telefonlar `wss://` ile buraya bağlanır; sunucu **her hamleyi oyunun
kendi kurallarıyla (`../game.ts`) doğrular**, yani gerçeğin kaynağı sunucudur ve telefondan hile yapılamaz.

```
Telefon ──wss──▶ Caddy (TLS) ──ws──▶ bu sunucu (127.0.0.1:8787)
```

## Neler var
- **Oda kodu:** Oda kuran 5 harflik bir kod alır (`0/O`, `1/I` yok), arkadaşı kodla katılır.
- **Hızlı eşleşme:** Aynı tahta boyutunu seçen iki yabancı eşleşir (40 sn hamle süresiyle).
- **Yeniden bağlanma:** Her oyuncunun cihazda saklanan gizli bir anahtarı var. İnternet kopsa, uygulama
  kapansa bile aynı koltuğa geri oturur. İki oyuncu da 15 dk yoksa oda silinir.
- **Hamle süresi:** Odada Süresiz / 20 sn / 40 sn. Süre dolunca sunucu o oyuncu için basit bir hamle oynar.
- **Onaylı geri alma:** Biri ister, öteki kabul ederse son hamle geri alınır.
- **Rövanş:** Oyun bitince iki taraf da isterse yeni oyun, taraflar yer değiştirir (diğeri başlar).
- Sınırlar: en fazla 500 oda, mesaj en fazla 1 KB, bağlantı başına saniyede 20 mesaj, 25 sn'de bir canlılık
  kontrolü.

## Kurulum (herkese açık bir sunucuda)

Dozi'nin bildirim sunucusu evdeki bir cihazda çalışıp yalnızca dışarı bağlanıyordu. Bu sunucu ise internetten
**gelen** bağlantıları kabul eder; bu yüzden alan adı, TLS ve açık 80/443 portları gerekir.

### Hızlı kurulum (önerilen)

**1. DNS (bilgisayarından, bir kez).** Alan adının DNS ayarlarında bir **A kaydı** ekle:
`rosadots.mifarosa.com` → `217.18.208.118` (`dozi.mifarosa.com` ile aynı yerden). Yayılması birkaç dakika sürebilir.

**2. Sağlayıcının güvenlik duvarı (bir kez, gerekiyorsa).** Sunucunun barındırıldığı yerde (bulut ya da hosting paneli)
80 ve 443 portları dışarıya açık olmalı. Birçok sağlayıcıda varsayılan olarak kapalıdır; panelde "firewall",
"security group" ya da "güvenlik listesi" bölümünden kaynak `0.0.0.0/0`, protokol TCP, port `80` ve `443` için izin ekle
(Oracle Cloud'da: VCN → Security List → Ingress Rules). Betik sunucunun **içindeki** güvenlik duvarını (`ufw`,
`iptables`) kendisi açar, ama sağlayıcının panelindekine dokunamaz.

**3. Sunucuda tek komut:**

```sh
ssh deploy@217.18.208.118
git clone https://github.com/mifarosa/rosadots ~/rosadots
bash ~/rosadots/server/install.sh
```

Betik sırayla şunları yapar ve her adımda ne yaptığını yazar:

1. Node.js 20.6+ yoksa resmî Node.js 22'yi nodejs.org'dan, sağlama toplamını doğrulayarak kurar.
2. Kodu günceller (`git pull`).
3. Bağımlılıkları kurar (`npm ci --omit=dev`), yoksa `.env` oluşturur. Var olan `.env`'e dokunmaz.
4. Caddy'yi kurar (yoksa), `Caddyfile`'a yalnızca kendi bloğunu yazar (başka siteler varsa korunur), doğrular,
   güvenlik duvarında 80/443'ü açar (`ufw` ya da `iptables`).
5. systemd servisini (`rosadots-server`) yazar ve başlatır.
6. Kontrol eder: sunucu yerelde ayakta mı, DNS bu alan adını çözüyor mu, `https://rosadots.mifarosa.com` yanıt veriyor mu.

Sonunda `wss://rosadots.mifarosa.com` adresinin hazır olduğunu yazar. Sertifika alınamazsa (genelde DNS ya da port
sorunu) sebebi söyler; düzeltince betiği **tekrar çalıştırmak güvenlidir**.

Alan adını değiştirmek için: `ROSADOTS_DOMAIN=baska.alan.adi bash ~/rosadots/server/install.sh`.
Servis `root` yerine betiği çalıştıran kullanıcıyla (burada `deploy`) çalışır.

### Elle kurulum (ayrıntı)

Hızlı kurulum işini yaptıysa bunları okuman gerekmez. Betiğin yaptıklarının elle karşılığı:

**1. DNS.** Alan adının DNS ayarlarında bir **A kaydı** ekle: `rosadots.mifarosa.com` → sunucunun IP adresi.
(`dozi.mifarosa.com` ile aynı yerden.) Yayılması birkaç dakika sürebilir.

**2. Güvenlik duvarı.** 80 ve 443 portları dışarıya açık olmalı (sağlayıcının panelinde ve sunucudaki `iptables`/`ufw`'de).

**3. Caddy** (otomatik ücretsiz TLS sertifikası):

```sh
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

`/etc/caddy/Caddyfile` dosyasının içeriğini `Caddyfile.example` ile değiştir, sonra:

```sh
sudo systemctl reload caddy
```

**4. Node.js 22** (yoksa) ve sunucu kodu. Sunucu depodaki `game.ts` gibi dosyaları kullandığı için **tüm depoyu** indirir:

```sh
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
sudo git clone https://github.com/mifarosa/rosadots /opt/rosadots
sudo chown -R $USER /opt/rosadots
cd /opt/rosadots/server
npm ci --omit=dev
cp .env.example .env
```

> Depo özelse `git clone` kimlik ister (deploy key ya da kişisel erişim anahtarı).
> Kod `main`'e birleşmediyse dalı belirt: `git clone -b DAL_ADI ...`.

**5. Elle dene:**

```sh
npm start
```

`rosadots server listening on 127.0.0.1:8787` yazmalı. Durdurmak için `Ctrl+C`.

**6. Sürekli çalıştır (systemd):**

```sh
sudo cp rosadots-server.service /etc/systemd/system/
sudo nano /etc/systemd/system/rosadots-server.service   # User= ve yolları kendine göre düzelt
sudo systemctl daemon-reload
sudo systemctl enable --now rosadots-server
journalctl -u rosadots-server -f
```

**7. Dışarıdan dene** (kendi bilgisayarından): HTTP 426 / "Upgrade Required" gibi bir yanıt, sunucunun
TLS arkasında ayakta olduğunu gösterir:

```sh
curl -i https://rosadots.mifarosa.com
```

## Güncelleme

Betiği tekrar çalıştırmak yeterli (kodu çeker, bağımlılıkları ve servisi yeniler):

```sh
bash ~/rosadots/server/install.sh
```

Elle: `cd ~/rosadots && git pull && cd server && npm ci --omit=dev && sudo systemctl restart rosadots-server`.

Oyun kuralları (`game.ts`) değiştiyse uygulamayı da yeniden derleyip yayınla: telefon ve sunucu aynı kuralları
kullanmalı. Yeniden başlatma açık odaları siler; oynayanlar odaya geri dönemez, o yüzden sakin bir saatte yap.

## Yerelde deneme (Expo Go)

Bilgisayarında sunucuyu çalıştır, telefonu aynı Wi-Fi'ye bağla:

```sh
cd server && npm install && HOST=0.0.0.0 npm start
```

Uygulamanın kök klasöründe bir `.env` dosyası oluştur (bilgisayarının yerel IP adresiyle):

```
EXPO_PUBLIC_ONLINE_URL=ws://192.168.1.20:8787
```

Sonra `npx expo start`. Düz `ws://` yalnızca geliştirmede çalışır; TestFlight/App Store sürümleri `wss://` ister.

## Testler

```sh
cd server && npm test        # oda mantığı (sahte saatle), gerçek soketlerle uçtan uca, telefon tarafı oturumu, install.sh
npm run typecheck
```

## Gelmiyorsa

| Belirti | Bak |
| --- | --- |
| Uygulama "Sunucuya bağlanılıyor…" da kalıyor | `journalctl -u rosadots-server -f` ve `sudo systemctl status caddy`. `curl -i https://rosadots.mifarosa.com` cevap vermiyorsa DNS ya da 80/443 portları. |
| Caddy sertifika alamıyor | DNS A kaydı doğru IP'ye gitmeli ve 80 portu dışarıdan açık olmalı (`journalctl -u caddy`). |
| Telefonda hemen düşüyor | Uygulama `wss://` kullanıyor mu? `EXPO_PUBLIC_ONLINE_URL` ayarlı değilse varsayılan `wss://rosadots.mifarosa.com`. |
| "Oda bulunamadı" | Kod yanlış, oda süresi dolmuş ya da sunucu yeniden başlatılmış. |
