# Historiearkiv

## Lokal demo

Åbn projektet via en lokal webserver, eksempelvis VS Code-udvidelsen **Live Server**, og gå til `index.html`. Uden Firebase-konfiguration gemmes forslag lokalt i browseren.

## Aktivér Firebase

1. Opret et Firebase-projekt.
2. Aktivér Firestore Database og Storage.
3. Aktivér Google som loginudbyder under Authentication.
4. Tilføj `localhost` og `127.0.0.1` som godkendte domæner under Authentication > Settings > Authorized domains.
5. Kopiér webappens konfiguration ind i `firebase-config.js`.
6. Udgiv `firestore.rules` og `storage.rules` til Firebase.

Den tilladte konto er `slusemester@gmail.com` og er angivet både i appen og i Firebase-reglerne.