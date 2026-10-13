# Istruzioni per gli agenti (Claude Code, Codex, ecc.)

Prima di toccare qualcosa leggi `LEGGIMI-PRIMA.md`: setup, build dell'APK, architettura e soprattutto la sezione 5 con le trappole del progetto.

In breve:
- La logica va in `src/domain/` con test `*.test.ts` accanto. Lancia `npm test` prima di dire che hai finito.
- Testi dell'interfaccia in italiano normale; numeri e date con `src/lib/formato.ts`.
- `npm run seed` prima di ogni build che va su un telefono.
- I widget Android leggono le chiavi `mf_w_*`: `src/domain/widget.ts` e `MfNotte.java` si cambiano insieme.
- Non unire a `main` e non pubblicare (`npm run deploy`) senza il via di Nico.
