# Audivine Music Bot (əvvəlki adı: Nicraen)

Audivine çox inkişaf etmiş, Discord üçün qurulmuş Musiqi Botudur. Bota həm mətn kanalları, həm də React-base Dashboard üzərindən tam nəzarət etmək mümkündür. 

## 🚀 Xüsusiyyətlər

- **Yüksək Keyfiyyətli Səs Playback-i**: Musiqiləri təmiz və kəsintisiz oxudur.
- **Veb İdarəetmə Paneli (Dashboard)**: Şəxsi musiqi paneli üzərindən mahnıları dəyişmək, irəli/geri çəkmək, növbə yaratmaq və səs səviyyəsini idarə etmək.
- **WebSocket ilə Real Vaxt məlumatları**: Bot və Dashboard tam real vaxt rejimində (real-time) işləyir.
- **Çoxlu platforma dəstəyi**: YouTube, Spotify və s.

## 🛠 Qurulum 

Botu lokal olaraq başlatmaq üçün:

1. **Kitabxanaları Yükləmək**
   ```bash
   npm install
   ```

2. **Dəyişənlər (.env)**
   Layihənin kök qovluğunda bir `.env` faylı yaradın və aşağıdakı dəyərləri daxil edin:
   ```env
   TOKEN="sizin_bot_tokeniniz"
   CLIENT_ID="sizin_botun_client_id_si"
   CLIENT_SECRET="sizin_botun_client_secret_kodu"
   MONGO_URI="Varsa mongodb kodu" # İsteğe bağlı
   ```

3. **Botu İşe Salmaq**
   ```bash
   npm start
   ```

*(Şəxsi fayllar avtomatik olaraq gizlədilib və ".gitignore" edilmişdir, ona görə githuba yüklənmir).*
