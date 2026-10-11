ECHO – lokaler PWA-Prototyp (Version 5)
=======================================

Was enthalten ist
- Mobile-first Web-App mit dunklem Design und Akzent #e8a04a
- Grosse Schaltfläche „Audio hochladen“ (mp3, wav, m4a, ogg, aac), Übungston oder eigene Quelle mit dem Mikrofon.
  Jede Quelle hat eine Vorschau („Anhören“ mit Pause, Dateiname, Dauer, Anzahl 5-s-Stücke), erst danach „Training starten“.
  Hochgeladene, geübte und aufgenommene Quellen laufen durch dieselbe Pipeline.
- 5-Sekunden-Ablauf (Konstante SEGMENT_SECONDS im Quelltext): Original hören -> nachsprechen (automatische Aufnahme) -> Signalton -> 3 s Pause -> eigene Stimme hören.
  Das letzte, kürzere Stück wird passend kurz abgespielt; die Aufnahme dauert dann so lang wie das Stück (mindestens 3 s).
- Pause/Fortsetzen: Die Zeit während der Pause zählt nicht mit. Beim Fortsetzen läuft Original bzw. deine Wiedergabe
  an derselben Stelle weiter, die Mikrofonaufnahme wird pausiert und fortgesetzt.
- Wiederholen, Nächste (im letzten Stück „Fertig“), Training beenden – alles auch mitten in einer Runde.
- Sprachsteuerung (optional, Taste „Sprachsteuerung einschalten“ auf dem Trainings-Bildschirm):
  „Pause“, „Fortsetzen“ / „weiter“, „Wiederholen“, „Nächste“. Sie hört dauerhaft zu und startet sich selbst neu.
  Sie bleibt auch WÄHREND der Aufnahme aktiv (Start kurz nach dem Aufnahmebeginn, damit sich beides nicht ins Gehege kommt).
  Manche Geräte erlauben Mikrofon-Aufnahme und Spracherkennung nicht gleichzeitig. Bricht dort die Aufnahme vorzeitig ab
  (Mikrofon-Spur beendet, Recorder stoppt zu früh, Mikrofon stumm), schaltet Echo die Erkennung während der Aufnahme
  automatisch aus, startet die Aufnahme neu und zeigt einen Hinweis. Pause per Taste ist immer der sichere Weg.
  Die App ist komplett ohne Sprachbefehle bedienbar.
- Aufnahme-Qualität: Mikrofon mit Echo-Unterdrückung, Rauschunterdrückung, Auto-Pegel (vom Gerät, mono), danach
  Hochpass ~100 Hz, Tiefpass ~7 kHz und ein einfaches Noise-Gate (Schwelle aus dem Raumpegel der ersten 0,5 s).
  Das ist eine Signalbereinigung. Echo trennt KEINE einzelnen Personen oder Stimmen voneinander. Hintergrundgeräusche
  und andere Stimmen im Raum können weiterhin zu hören sein. Ein volles Stück wird 5 s lang aufgenommen (letztes, kürzeres Stück: so lang wie das Stück, mindestens 2 s; Rest unter 1 s wird übersprungen).
- Vergleich nach jedem Stück (grobe Schätzung, komplett lokal und offline): Tonhöhenverlauf (Autokorrelation, 70 bis 400 Hz,
  ca. 20 Frames pro Sekunde) und Lautstärkeverlauf von Original (Akzentfarbe) und dir (Weiss) auf einem Canvas, dazu in Worten
  „Du sprichst im Schnitt etwa X Halbtöne höher/tiefer“ und „Rhythmus-Ähnlichkeit grob: gut/mittel/schwach“.
  Die Ansicht ist einklappbar. Sie erscheint erst nach der Wiedergabe deiner Stimme und stört das Training nie:
  Schlägt die Analyse fehl, steht nur ein Hinweis da.
  Grenzen: Gemessen werden nur Tonhöhe und Lautstärke-Hüllkurve, nicht Wörter, Aussprache oder Klang. Mehrere Stimmen,
  Musik oder Rauschen im Original machen die Tonhöhe unzuverlässig; Oktavfehler sind möglich. Die Halbton-Zahl vergleicht den
  Mittelwert (Median) beider Stücke, nicht Ton für Ton. Der Rhythmus vergleicht nur den Lautstärke-Verlauf (mit bis zu 1 s Versatz).
  Der Original-Abschnitt wird nur für das aktuelle 5-s-Stück dekodiert (WAV exakt, kurze Dateien bis 3 Minuten ganz, danach
  nur lange MP3 näherungsweise; sonst „Vergleich nicht möglich“).
- Wiedergabe deiner Stimme: Sie wird schon während der 3-s-Pause vorbereitet und startet ohne Verzögerung, mit weichem
  Ein- und Ausblenden (0,15 s / 0,3 s) und leichter Lautstärke-Angleichung. Die Dauer entspricht der echten Aufnahmelänge,
  danach steht sofort „Bereit“.
- Aufnahmen bleiben dauerhaft auf dem Gerät (IndexedDB, mit Stücknummer, Datum, Quellname).
  Liste „Aufnahmen auf diesem Gerät“ auf Startseite und Abschluss-Bildschirm: Abspielen, Herunterladen (↓), Löschen (🗑).
  Sie überleben Schliessen und Neuladen. Löschen der Website-Daten im Browser löscht auch die Aufnahmen.
- Bildschirm bleibt während der ganzen Trainingssitzung wach (Wake Lock), wird nach App-Wechsel neu angefordert.
- Offline: Die App-Hülle, Schriften (Fraunces, Outfit lokal in fonts/) und Icons werden beim ersten Laden gecacht.
  Es werden keine externen Adressen mehr geladen.
- PWA: Manifest, Icons (192, 512, maskable 512, apple-touch-icon 180, SVG), Service Worker echo-shell-v5.

Dateien
index.html, sw.js, manifest.webmanifest, icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png,
apple-touch-icon.png, fonts/ (woff2 + Lizenzen OFL), README_DE.txt

In-App-Browser (z. B. GitHub-App, Instagram, Facebook)
- Dort fehlen oft Mikrofon, Dateiauswahl und Installation. Echo erkennt solche Browser und zeigt oben den Hinweis
  „Öffne diese Seite in Chrome oder Safari“ mit Knopf „Link kopieren“.
- Fehlt dem Browser die Aufnahme-Funktion (MediaRecorder/Mikrofon), erscheint: „Dieser Browser unterstützt keine Aufnahme - bitte in
  Chrome (Android) oder Safari (iPhone) öffnen.“ Die Oberfläche bleibt trotzdem sichtbar, Vorschau und Anhören gehen weiter.
- Unerwartete Fehler zeigt ein kleines rotes Banner oben auf der Seite (mit Zeilennummer), damit man sie melden kann.
- Der Code nutzt keine Syntax, die erst in sehr neuen Browsern läuft (kein ?. / ??), und prüft jede optionale API vorher.

Wichtig
- Mikrofon benötigt HTTPS (oder localhost) und eine Nutzerfreigabe.
- Bitte Kopfhörer verwenden, sonst nimmt das Mikrofon das Original mit auf.
- Wiedergabe-Fade und -Normalisierung laufen über Web Audio. Kann der Browser die Aufnahme nicht dekodieren, spielt Echo
  sie über ein Audio-Element mit Lautstärke-Rampe ab (auf iPhone ist die Elementlautstärke nicht regelbar: dort ohne Fade).
- Die Spracherkennung des Browsers braucht meist Internet (Chrome sendet Audio an einen Server). Offline gehen nur die Tasten.
  Auf iPhone/Safari ist die Spracherkennung eingeschränkt oder fehlt; dann zeigt die App einen Hinweis.
- Audio-Codec-Unterstützung unterscheidet sich (iPhone speichert M4A/MP4, Android WebM/Opus).
- iOS verlangt für Audio-Wiedergabe einen Nutzertipp: Training immer mit dem Knopf „Training starten“ beginnen.
- Dies ist ein funktionsfähiger Prototyp, keine geprüfte Store-App. Das Verhalten auf echten Geräten ist noch nicht bestätigt.

Update-Hinweis
- Version 5 löscht alte Caches (echo-shell-v1 bis -v4). Nach dem Hochladen die App einmal online öffnen, dann ein zweites Mal
  schliessen/öffnen, damit der neue Service Worker aktiv wird.
- Bei jeder Änderung an den Dateien in sw.js die Version (CACHE = 'echo-shell-vN') erhöhen.

Gerätetest (Anleitung)
1. Dateien auf einen HTTPS-Webhost laden (ganze Ordnerstruktur inkl. fonts/).
2. Android (Chrome): Seite öffnen -> Menü -> „App installieren“. iPhone (Safari): Teilen -> „Zum Home-Bildschirm“.
3. Mit WLAN/Mobilfunk EINMAL die App öffnen und die Startseite sehen (Laden = Cache füllen). App schliessen und neu öffnen.
4. Flugmodus einschalten (WLAN aus). App neu öffnen: Startseite, Schriften und Icon müssen normal erscheinen,
   Badge zeigt „Offline“.
5. Kopfhörer anschliessen. „Übungston“ -> „Training starten“. Mikrofon erlauben.
6. Prüfen: Pause mitten im Original -> 10 s warten -> Fortsetzen: gleiche Stelle, Zähler springt nicht.
   Pause während „Jetzt nachsprechen“ (Taste oder Sprache) -> Fortsetzen: Aufnahme dauert insgesamt 5 s Sprechzeit.
7. Nach dem Training: „Aufnahmen auf diesem Gerät“ -> Abspielen. App komplett schliessen, neu öffnen: Aufnahme noch da?
   ↓ lädt die Datei herunter, 🗑 löscht sie.
8. Mit Internet (nicht Flugmodus): Sprachsteuerung einschalten, „Pause“, „Fortsetzen“, „Nächste“ sagen – auch während
   du nachsprichst. Bricht die Aufnahme ab, muss ein Hinweis erscheinen und die Aufnahme neu starten.
   Im Flugmodus geht nur die Tastenbedienung.
8b. Aufnahme prüfen: Klingt sie sauber? Zu leise/zu dumpf? Ist 5 s lang? Beginnt die Wiedergabe sofort und weich?
9. Bildschirmsperre: Training 5 Minuten laufen lassen – bleibt der Bildschirm an? (Wake Lock; nicht auf jedem Gerät garantiert.)
10. Sperrbildschirm/App-Wechsel während des Trainings: Audio und Timer können vom System angehalten werden. Bitte notieren, was passiert.

Was automatisiert getestet wurde (Chromium, Fake-Mikrofon, lokaler Server) und was nicht
- Getestet: Service-Worker-Cache, Offline-Neuladen, Schriften/Icons/Manifest aus dem Cache, keine externen Requests,
  Pause/Fortsetzen (Timer, Audio, Recorder), Aufnahme (volles 5-s-Stück), IndexedDB (speichern, neu laden, abspielen,
  herunterladen, löschen), Sprachsteuerung mit simulierter Spracherkennung auch während der Aufnahme, Rückfall bei
  simuliertem Abbruch, Filterkette (Messung per OfflineAudioContext), Noise-Gate-Logik, Fade-Verlauf, Normalisierung,
  kürzeres letztes Stück.
- NICHT prüfbar ohne echte Geräte: ob Aufnahme und echte Spracherkennung gleichzeitig laufen (und ob der Rückfall nötig wird),
  wie gut Filter/Gate mit echten Stimmen und Raumgeräuschen klingen, die Wirkung der Geräte-Rauschunterdrückung,
  iOS-Safari-Audio-Session, Wake Lock, Cache-Eviction durch das Betriebssystem,
  Mikrofon-Berechtigungsdialoge, echte Spracherkennung (braucht Internet), Verhalten bei gesperrtem Bildschirm.

Nächste Schritte für eine robuste Version
- Tests auf mehreren iPhones und Samsung-Geräten
- Optional native Wrapper (Capacitor) für zuverlässigere Gerätesperre-/Audio-Verwaltung


==== NEU in v6: Eigene Stimme wird zuverlässig abgespielt (iPhone) ====
Stücke sind jetzt 5 Sekunden lang (zentrale Konstante SEGMENT_SECONDS=5 in index.html; Übungston = 2 Stücke = 10 s).

Wahrscheinliche Ursache (Vermutung, auf dem Handy des Users nicht reproduzierbar):
 1. iOS zählt nur click/touchend als Geste fürs Entsperren von Audio, nicht pointerdown/touchstart. Der AudioContext blieb
    deshalb "suspended", und das <audio>-Element für die eigene Stimme war nie freigeschaltet. Das Original (Element, direkt
    beim Tippen gestartet) lief, die eigene Stimme (Web Audio / automatisches play()) blieb still, und der Fehler wurde verschluckt.
 2. Web Audio wird auf dem iPhone vom Stumm-Schalter lautlos geschaltet, <audio>-Elemente nicht.
 3. Nach getUserMedia stellt iOS die Audio-Session auf Aufnahme um (leise/Hörer); der AudioContext kann "interrupted" sein.

Änderungen:
 - Entsperrung bei jedem click/touchend/pointerup: AudioContext.resume() plus stilles Abspielen auf dem reservierten <audio>-Element.
 - Nach der Aufnahme sofort alle Mikro-Tracks und die Filterkette (inkl. MediaStreamDestination) stoppen und trennen.
 - navigator.audioSession.type: "play-and-record" während der Aufnahme, danach "playback" (falls vorhanden).
 - Vor der Wiedergabe resume() erzwingen und bis zu 2,5 s auf "running" warten (auch bei "interrupted").
 - Auf iPhone/iPad spielt die eigene Stimme als <audio> mit Blob-URL; Lautstärke-Angleichung und Ein-/Ausblenden sind fest in die
   WAV eingerechnet. Auf anderen Geräten Web Audio, bei Fehler Rückfall auf <audio>.
 - Schlägt alles fehl (z. B. NotAllowedError): sichtbare Meldung "Wiedergabe nicht möglich: ..." und grosser Knopf "Deine Stimme anhören".
 - Nach jedem Stück: Knöpfe "Original anhören", "Meine Stimme anhören", "Beide nacheinander" und Schalter
   "Original danach wiederholen" (Standard AN; spielt nach der eigenen Stimme das Original noch einmal).
 - Lautstärke: Ziel-RMS etwa -18 dBFS, Verstärkung 0,5 bis 8, nie über Spitze 0,95. Hinweis auf Lautstärke und Stumm-Schalter.

Nur auf einem echten iPhone prüfbar: ob die Wiedergabe nach der 3-s-Pause von selbst startet, ob der Stumm-Schalter eine Rolle spielt,
Lautsprecher statt Hörer, Verhalten bei Anrufen/Siri (Unterbrechung), Safari-Version (audioSession ab iOS 16.4).
Feste Bedienleiste unten im Trainingsbildschirm (auch auf kleinen Handys ohne Scrollen sichtbar):
 - gross "Weiter (nächste 5 Sekunden)" (im letzten Stück "Fertig"), jederzeit aktiv, springt sofort zum nächsten Stück, auch mitten in der Runde
 - daneben "Wiederholen" und "Pause/Fortsetzen"
 - Sprachbefehl "Weiter" = nächstes Stück (ist die Runde pausiert, setzt "Weiter" fort; während deiner Aufnahme wird "Weiter" per Sprache
   ignoriert, damit ein gesprochenes "weiter" im Text die Runde nicht abbricht; die Taste geht immer).
Test (Mac/Linux): node test/v6.js (Playwright, simulierte Zustände suspended/interrupted, NotAllowedError, Dekodierfehler, Tracks gestoppt).
