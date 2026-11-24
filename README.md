# Feder

Eine vollständig lokale Handschrift-Web-App auf Deutsch, für iPad, Apple Pencil und Desktop. Kein Build und kein Server nötig.

## Auf Netlify veröffentlichen

Feder wird direkt aus diesem GitHub-Repository auf Netlify veröffentlicht. **Jeder Push auf `main` geht automatisch live**, ohne ZIP und ohne Hochladen per Hand. Die Einstellungen stehen in [`netlify.toml`](netlify.toml): veröffentlicht wird der Ordner `netlify-drop`, ein Build-Schritt ist nicht nötig.

### Einmalig: Repository mit Netlify verbinden

> **Wichtig, falls Feder schon per Netlify Drop online ist:** Die Handschrift, Entwürfe und das Archiv liegen im Browser des iPads und sind an die Web-Adresse gebunden. Eine **neue** Netlify-Seite hat eine neue Adresse und damit einen leeren Speicher. Deshalb entweder die **bestehende** Seite mit GitHub verbinden (Variante A) oder vorher auf dem iPad unter **Handschrift** auf **Sichern** tippen und auf der neuen Adresse **Laden**.

**Variante A: bestehende Drop-Seite verbinden (Adresse bleibt gleich)**

1. In Netlify die vorhandene Seite öffnen.
2. **Site configuration → Build & deploy → Continuous deployment → Link repository** wählen.
3. **GitHub** wählen und das Repository `federapp` auswählen (beim ersten Mal Netlify den Zugriff auf GitHub erlauben).
4. Branch: `main`. Build command und Publish directory werden aus `netlify.toml` übernommen (`netlify-drop`). Leer lassen oder genau so eintragen.
5. Speichern. Netlify baut sofort die aktuelle Version aus GitHub.

**Variante B: neue Seite anlegen**

1. In Netlify **Add new site → Import an existing project → GitHub** wählen.
2. Repository `federapp` auswählen, Branch `main`.
3. Die Einstellungen kommen aus `netlify.toml`. Auf **Deploy** klicken.
4. Optional unter **Domain management** einen eigenen Namen vergeben (z. B. `feder-xyz.netlify.app`).

### Danach: Änderungen veröffentlichen

1. Dateien in `netlify-drop/` ändern.
2. Lokal testen (siehe [Lokal entwickeln](#lokal-entwickeln)).
3. Committen und auf `main` pushen:

   ```bash
   git add netlify-drop
   git commit -m "Beschreibung der Änderung"
   git push
   ```

4. Netlify veröffentlicht nach etwa einer halben Minute. Den Stand zeigt die Seite unter **Deploys** in Netlify.

Wer über einen Branch und Pull Request arbeitet, bekommt von Netlify für jeden Pull Request automatisch eine **Deploy Preview** mit eigener Adresse. Erst der Merge nach `main` geht live. Ein fehlerhaftes Deployment lässt sich unter **Deploys** mit **Publish deploy** auf einer älteren Version sofort zurücknehmen.

Öffne anschließend dieselbe HTTPS-Adresse auf deinem iPad in Safari. Die Schrift liegt auf dem iPad, nicht auf dem Computer, der die Website hochgeladen hat. Für ein übertragenes Alphabet die Sicherungsdatei laden.

### Notlösung ohne Git: Netlify Drop

Den Ordner **netlify-drop** bei https://app.netlify.com/drop hineinziehen; `index.html` liegt darin auf oberster Ebene. Bei einer mit GitHub verbundenen Seite nicht verwenden, denn der nächste Push überschreibt den manuellen Stand. ZIP-Dateien werden nicht mehr im Repository gespeichert, weil sie bei jeder Änderung veralten.

## Benutzung

1. Unter **Handschrift** Zeichen zeichnen und jede Variante speichern. Grundlinie: grün; Hilfslinien für Großbuchstaben/Oberlängen, kleine Buchstaben und Unterlängen. 2–3 Varianten pro Zeichen sind ein guter Anfang; maximal 12.
   Buchstaben ohne Unterlänge werden automatisch an ihrer Unterkante auf die Papierlinie gesetzt. Bei g, j, p, q und y sowie Satzzeichen gilt die grüne Zeichen-Grundlinie. Bei gespeicherten Varianten lässt sich diese über **Ausrichten** nachträglich korrigieren. Diese Korrektur wird lokal und in Sicherungen gespeichert. Die Unordnung variiert Neigung, Größe, Abstände und Varianten, ohne die Grundlinie vertikal zu verschieben. Die Zeichenfläche passt ihre Pixelauflösung an das Display an und zeichnet geglättete Kurven mit konstanter Kugelschreiber-Strichstärke.
2. Im **Studio** Text einsetzen (Reiter **Text**). Unter **Papier** und **Schrift** liegen die übrigen Einstellungen. Vier eigene Papierarten, A4/A5/Letter, Tinte, Schriftgröße, Breite, Wortabstand, Unordnung, Linienabstand, Grundlinie und Rand einstellen. Leerzeichen sind standardmäßig breiter; der Regler **Wortabstand** passt sie unabhängig vom Buchstabenabstand an. Die Abstände skalieren mit Schriftgröße und Schriftbreite und bleiben im Entwurf, Archiv und in Sicherungen erhalten. Fehlende Zeichen werden ausdrücklich angezeigt und optional mit der Beispielschrift ergänzt.
   Über **＋ Textfeld** weitere Bereiche erstellen. Jedes Feld hat einen eigenen Inhalt, Namen, Rahmen und eine Startseite. Text links bearbeiten, Rahmen auf dem Papier mit Maus, Finger oder Stift verschieben und an Kanten oder Ecken vergrößern/verkleinern. Die Breite bestimmt den Zeilenumbruch; die Höhe bestimmt, wie viel Text pro Seite hineinpasst. Überlauf beginnt auf der nächsten Seite an der ersten Schreiblinie und nutzt das Blatt bis zum unteren Seitenrand. Jede Fortsetzung lässt sich unabhängig verschieben und in Breite und Höhe verändern. Zum Bearbeiten ihren Rahmen auf der jeweiligen Seite auswählen; die Größenfelder links gelten dann für diese Fortsetzung. Die Startseite gehört weiterhin zum gesamten Textfluss. Angepasste Fortsetzungen werden lokal und in Sicherungen gespeichert. Auf linierten Blättern rasten Felder vertikal auf der gemeinsamen Papiergrundlinie ein. Auf karierten, gepunkteten und blanken Blättern lassen sie sich ohne Raster frei verschieben und verändern. Beim Wechsel zurück zu liniert werden die Textzeilen automatisch an den Linien ausgerichtet. Über **Duplizieren**, **Entfernen** und **Rückgängig** Felder verwalten. Mit Pfeiltasten ein fokussiertes Feld bewegen; Umschalt + Pfeiltasten ändern dessen Größe. Rahmen werden nicht exportiert. Feldpositionen und Inhalte bleiben lokal und in Sicherungen erhalten; Sicherungen älterer Versionen werden in ein erstes Textfeld übernommen.
   Alle Seiten stehen wie in Word untereinander in der Vorschau. Neue Folgeseiten erscheinen automatisch darunter. Durch Scrollen oder die Seitenpfeile navigieren; Textfelder können direkt auf jeder Seite bearbeitet werden. Die linke Steuerung bleibt auf größeren Displays beim Scrollen erreichbar.
3. **Exportieren**: als **.goodnotes**-Datei (jeder Strich wird echte, radierbare GoodNotes-Tinte, das Papier ist der Hintergrund), als mehrseitige PDF oder als PNG der aktuellen Seite, optional transparent. Auf dem iPad die Datei über das Teilen-Menü in GoodNotes öffnen oder die PDF teilen.
4. **Sichern** (unter Handschrift): JSON-Datei mit Alphabet, Text, Vorlage und Einstellungen in der Dateien-App aufbewahren. Auf einem anderen Gerät oder nach dem Löschen der Websitedaten über **Laden** wiederherstellen.
5. **Dokumente archivieren**: Im Studio oben den Dokumentnamen eintragen und **Archivieren** wählen. Danach aktualisiert **Speichern** denselben Eintrag. Über **Neu** alle aktuellen Blätter und Textfelder leeren; die bisherigen Blätter werden vorher archiviert. Handschrift und Papiergestaltung bleiben für das neue Dokument erhalten.
   Unter **Archiv** Dokumente suchen, öffnen, umbenennen oder entfernen. Entfernen lässt sich mit **Rückgängig** widerrufen. Beim Öffnen eines anderen Dokuments wird der bisherige Entwurf vorher gesichert. Jedes Dokument enthält Text, Papierart, Vorlage, Schrifteinstellungen, Zufallsverteilung und die Positionen/Größen aller Textfelder und Fortsetzungen. Das Alphabet wird gemeinsam genutzt; Änderungen an Buchstaben gelten auch für erneut geöffnete Dokumente.
   **Sichern** im Archiv und unter Handschrift laden eine gemeinsame JSON-Datei mit Archiv, aktuellem Entwurf und Alphabet herunter. **Laden** unter „Handschrift“ stellt sie wieder her. Ältere Sicherungen ohne Archiv bleiben kompatibel und lassen das bestehende Archiv erhalten. Das Archiv ist lokal, ohne Konto oder Cloud-Sync; bis zu 1.000 Dokumente, abhängig vom verfügbaren Browserspeicher.

## Speicherung und Grenzen

- Gespeicherte Varianten, Text, Einstellungen, importiertes Papier und das Archiv bleiben in IndexedDB auf diesem Gerät erhalten, auch nach einem Reload oder Neustart. Falls IndexedDB nicht verfügbar ist, verwendet die App Local Storage. Der Speicherstatus steht am Seitenende. Archivieren und Dokumentwechsel schreiben Archiv und aktuellen Entwurf gemeinsam; bei einem Speicherfehler bleibt das bisherige Dokument geöffnet.
- Bei einem Speichervorgang versucht die App außerdem, dauerhaften Speicher anzufordern; ob der Browser ihn gewährt, entscheidet der Browser. Browserdaten können dennoch durch manuelles Löschen, Privatmodus oder Speicherbereinigung verloren gehen. Eine Sicherungsdatei ist die verlässliche zusätzliche Kopie.
- Die Speicheradresse ist an die Website gebunden: neue Domain, anderer Browser oder anderes Gerät haben einen eigenen Speicher. Es gibt keinen Cloud-Sync.
- Ungespeicherte Striche auf der Zeichenfläche sind ein Entwurf. Erst **Variante speichern** übernimmt sie in die Datenbank.
- Die integrierten Papierarten sind selbst erstellte Vorlagen, keine originalen GoodNotes-Dateien. Eigene Vorlagen werden als PNG/JPG bis 20 MB importiert und auf das gewählte Format skaliert. Passende Grundlinie und passenden Linienabstand mit den Reglern einstellen. PDF-Vorlagen werden noch nicht importiert.
- Texte bis 60.000 UTF-16-Zeichen. Sehr lange Exporte brauchen entsprechend mehr Speicher. Kein Rich Text, keine Schrifterkennung, keine automatische Erkennung von Vorlagenlinien.
- Vorschau (SVG) und PDF speichern eigene Zeichen als Vektorkurven, einschließlich der integrierten Papierlinien. Beim Zoomen werden sie ohne Vergrößern eines Seitenbildes neu dargestellt. Die Strichstärke ist unabhängig von der Schriftgröße einstellbar. Die Schrift besteht aus Zeichenpfaden; sie ist im PDF nicht als Text auswählbar.
- Der `.goodnotes`-Export enthält nur selbst gezeichnete Zeichen als Tinte; Ersatzzeichen aus der Beispielschrift fehlen darin (die App meldet ihre Anzahl). Eigene Bildvorlagen werden als Hintergrund übernommen. Noch nicht auf einem iPad bestätigt; bei Problemen die PDF verwenden.
- PNGs haben die vierfache Seitenauflösung (A4: 3176 × 4492 Pixel, ungefähr 384 dpi). PNGs bleiben Bilddateien; für verlustfreies Zoomen in GoodNotes die PDF verwenden.
- Importierte Papiervorlagen behalten ihre Bildauflösung. Fehlende Zeichen verwenden eine verfügbare lokale Schreibschrift; im PDF werden nur diese Ersatzzeichen als transparente, hochauflösende Einzelbilder eingebettet. Die selbst gezeichneten Buchstaben bleiben Vektoren.
- Alle App-Dateien einschließlich pdf-lib und dessen MIT-Lizenz sowie der Schriften Inter und JetBrains Mono liegen im Drop-Ordner. Es gibt keine extern geladenen Fonts, Bibliotheken oder Netzwerkaufrufe der App. Netlify selbst verarbeitet die üblichen Hosting-Anfragen.

## Lokal entwickeln

Die App ist reines HTML, CSS und JavaScript ohne Framework; die PDF-Bibliothek ist fertig mitgeliefert. Kein npm-Installieren und kein Build erforderlich. Benötigt wird nur [Node.js](https://nodejs.org) für den kleinen lokalen Server:

```bash
node scripts/serve.cjs
```

Dann http://127.0.0.1:4173 im Browser öffnen. Jeder andere statische HTTP-Server für `netlify-drop` funktioniert ebenso. `file://` eignet sich wegen browserabhängiger Speicherregeln nicht als regulärer Betrieb.

Hinweis: Der lokale Server sendet die Sicherheits-Header aus `netlify-drop/_headers` nicht. Die Content-Security-Policy erlaubt nur Skripte und Styles aus dem eigenen Ordner. Neue Dateien deshalb lokal in `netlify-drop/` ablegen und nicht von fremden Servern laden, sonst blockiert Netlify sie.

### Prüfskripte

`scripts/*-check.cjs` und `scripts/dots-performance.cjs` sind automatisierte Browser-Tests mit Playwright. Sie erwarten einen laufenden `scripts/serve.cjs` und schreiben Screenshots und Exporte nach `output/` (nicht versioniert). Sie laden Playwright, pdf-lib und pngjs derzeit über einen fest eingetragenen lokalen Pfad der Codex-Umgebung und laufen deshalb nur auf dem Rechner, auf dem sie erstellt wurden. Für das Deployment werden sie nicht gebraucht.

## Projektstruktur

| Pfad | Inhalt |
|---|---|
| `netlify-drop/` | Die komplette App. **Nur dieser Ordner wird veröffentlicht.** |
| `netlify-drop/index.html` | Einstiegsseite |
| `netlify-drop/app.js`, `textboxes.js`, `archive.js`, `vector.js` | App-Logik |
| `netlify-drop/ui.js` | Oberfläche: Reiter im Einstellungsbereich, Lichtreflex auf den Glasflächen |
| `netlify-drop/fonts/` | Inter und JetBrains Mono (SIL Open Font License, Lizenzen liegen daneben), lokal eingebunden |
| `netlify-drop/goodnotes.js` | Schreibt `.goodnotes`-Dateien (Format nach dem MIT-lizenzierten gnnote-Writer von Jakub Fabrici), ohne Netzwerkzugriff |
| `netlify-drop/styles.css`, `archive.css` | Gestaltung |
| `netlify-drop/vendor/` | pdf-lib (MIT-Lizenz) für den PDF-Export |
| `netlify-drop/_headers` | Sicherheits-Header für Netlify (CSP u. a.) |
| `netlify.toml` | Netlify-Einstellungen: Veröffentlichungsordner, kein Build |
| `scripts/serve.cjs` | Lokaler Entwicklungsserver auf Port 4173 |
| `scripts/*-check.cjs` | Browser-Tests (siehe oben) |
