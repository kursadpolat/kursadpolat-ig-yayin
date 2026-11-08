#!/bin/zsh
# Instagram token'ını GitHub Secret'a yazar (repoda token tutulmaz), IG_USER_ID değişkenini ayarlar, kuru test başlatır.
# Token ekrana basılmaz. Kullanım: zsh bulut-kur.sh
set -e
R=kursadpolat/kursadpolat-ig-yayin
grep '^IG_TOKEN=' ~/.config/kursadpolat-ig/env | cut -d= -f2- | tr -d '\n' | gh secret set IG_TOKEN -R $R > /dev/null
gh variable set IG_USER_ID -R $R -b 17841442810350648 > /dev/null
sleep 3
gh workflow run story.yml -R $R -f slot=0 -f kuru=true > /dev/null
echo "Bitti: token Secret'a yazildi, kuru test baslatildi."
