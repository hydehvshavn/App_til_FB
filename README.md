# Historiearkiv

## Lokal demo

Åbn projektet via en lokal webserver, eksempelvis VS Code-udvidelsen **Live Server**, og gå til `index.html`. Uden Firebase-konfiguration gemmes forslag lokalt i browseren.

## Aktivér Firebase

1. Opret et Firebase-projekt.
2. Aktivér Firestore Database og Storage.
3. Aktivér Microsoft som loginudbyder under Authentication.
4. Tilføj `localhost` som godkendt domæne under Authentication.
5. Kopiér webappens konfiguration ind i `firebase-config.js`.
6. Udgiv `firestore.rules` og `storage.rules` til Firebase.

Den tilladte konto er `hyde@hvshavn.dk` og er angivet både i appen og i Firebase-reglerne.