#!/bin/zsh
# Panoda duran Instagram token'ını env dosyasına yazar, ekrana basmaz; IG_USER_ID'yi API'den çeker
E=~/.config/kursadpolat-ig/env; mkdir -p ${E:h}
T=$(pbpaste | tr -d '[:space:]')
[ ${#T} -lt 50 ] && { echo "Panoda token yok gibi görünüyor (önce Meta panelinde Copy'ye bas)"; exit 1; }
J=$(curl -s "https://graph.instagram.com/v23.0/me?fields=user_id,username&access_token=$T")
U=$(echo $J | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("user_id",""),d.get("username",""))')
[ -z "${U%% *}" ] && { echo "Token geçersiz"; exit 1; }
printf 'IG_USER_ID=%s\nIG_TOKEN=%s\nMEDYA_URL=https://kursadpolat-medya.vercel.app\n' "${U%% *}" "$T" > $E
chmod 600 $E; echo "Token kaydedildi: @${U#* } (${#T} karakter)."
