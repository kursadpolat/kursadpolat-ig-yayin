#!/bin/zsh
# Token'ı şifreleyip repoya koyar, TOKEN_KEY secret'ını ve IG_USER_ID değişkenini ayarlar, kuru test başlatır.
# Token ekrana basılmaz. Kullanım: zsh bulut-kur.sh
set -e
cd "${0:A:h}"
R=kursadpolat/kursadpolat-ig-yayin
K=~/.config/kursadpolat-ig/token_key
[ -s $K ] || { openssl rand -base64 32 > $K; chmod 600 $K; }
export TOKEN_KEY=$(cat $K)
grep '^IG_TOKEN=' ~/.config/kursadpolat-ig/env | cut -d= -f2- | tr -d '\n' \
  | openssl enc -aes-256-cbc -pbkdf2 -a -A -salt -out token.enc -pass env:TOKEN_KEY
gh secret set TOKEN_KEY -R $R -b "$TOKEN_KEY" > /dev/null
gh variable set IG_USER_ID -R $R -b 17841442810350648 > /dev/null
git add token.enc bulut-kur.sh
git commit -q -m "Şifreli Instagram token'ı eklendi"
git push -q > /dev/null 2>&1
sleep 3
gh workflow run story.yml -R $R -f slot=0 -f tarih=2026-10-04 -f kuru=true > /dev/null
echo "Bitti: token şifreli yüklendi, kuru test başlatıldı."
