# Feder

Eine vollständig lokale Handschrift-Web-App auf Deutsch, für iPad, Apple Pencil und Desktop. Kein Build und kein Server nötig.

## Auf Netlify veröffentlichen

Den Ordner **netlify-drop** bei https://app.netlify.com/drop hineinziehen. In diesem Ordner liegt `index.html` direkt auf der obersten Ebene. Alternativ die beigefügte ZIP-Datei hochladen. Bei einem Git-basierten Netlify-Projekt verwendet `netlify.toml` denselben Ordner als Veröffentlichungsverzeichnis.

Öffne anschließend dieselbe HTTPS-Adresse auf deinem iPad in Safari. Die Schrift liegt auf dem iPad, nicht auf dem Computer, der die Website hochgeladen hat. Für ein übertragenes Alphabet die Sicherungsdatei laden.

## Benutzung

1. Unter **Meine Handschrift** Zeichen zeichnen und jede Variante speichern. Grundlinie: grün; Hilfslinien für Großbuchstaben/Oberlängen, kleine Buchstaben und Unterlängen. 2–3 Varianten pro Zeichen sind ein guter Anfang; maximal 12.
   Buchstaben ohne Unterlänge werden automatisch an ihrer Unterkante auf die Papierlinie gesetzt. Bei g, j, p, q und y sowie Satzzeichen gilt die grüne Zeichen-Grundlinie. Bei gespeicherten Varianten lässt sich diese über **Ausrichten** nachträglich korrigieren. Diese Korrektur wird lokal und in Sicherungen gespeichert. Die Unordnung variiert Neigung, Größe, Abstände und Varianten, ohne die Grundlinie vertikal zu verschieben. Die Zeichenfläche passt ihre Pixelauflösung an das Display an und zeichnet geglättete Kurven mit konstanter Kugelschreiber-Strichstärke.
2. Im **Papierstudio** Text einsetzen. Vier eigene Papierarten, A4/A5/Letter, Tinte, Schriftgröße, Breite, Wortabstand, Unordnung, Linienabstand, Grundlinie und Rand einstellen. Leerzeichen sind standardmäßig breiter; der Regler **Wortabstand** passt sie unabhängig vom Buchstabenabstand an. Die Abstände skalieren mit Schriftgröße und Schriftbreite und bleiben im Entwurf, Archiv und in Sicherungen erhalten. Fehlende Zeichen werden ausdrücklich angezeigt und optional mit der Beispielschrift ergänzt.
   Über **＋ Textfeld** weitere Bereiche erstellen. Jedes Feld hat einen eigenen Inhalt, Namen, Rahmen und eine Startseite. Text links bearbeiten, Rahmen auf dem Papier mit Maus, Finger oder Stift verschieben und an Kanten oder Ecken vergrößern/verkleinern. Die Breite bestimmt den Zeilenumbruch; die Höhe bestimmt, wie viel Text pro Seite hineinpasst. Überlauf beginnt auf der nächsten Seite an der ersten Schreiblinie und nutzt das Blatt bis zum unteren Seitenrand. Jede Fortsetzung lässt sich unabhängig verschieben und in Breite und Höhe verändern. Zum Bearbeiten ihren Rahmen auf der jeweiligen Seite auswählen; die Größenfelder links gelten dann für diese Fortsetzung. Die Startseite gehört weiterhin zum gesamten Textfluss. Angepasste Fortsetzungen werden lokal und in Sicherungen gespeichert. Auf linierten Blättern rasten Felder vertikal auf der gemeinsamen Papiergrundlinie ein. Auf karierten, gepunkteten und blanken Blättern lassen sie sich ohne Raster frei verschieben und verändern. Beim Wechsel zurück zu liniert werden die Textzeilen automatisch an den Linien ausgerichtet. Über **Duplizieren**, **Entfernen** und **Rückgängig** Felder verwalten. Mit Pfeiltasten ein fokussiertes Feld bewegen; Umschalt + Pfeiltasten ändern dessen Größe. Rahmen werden nicht exportiert. Feldpositionen und Inhalte bleiben lokal und in Sicherungen erhalten; Sicherungen älterer Versionen werden in ein erstes Textfeld übernommen.
   Alle Seiten stehen wie in Word untereinander in der Vorschau. Neue Folgeseiten erscheinen automatisch darunter. Durch Scrollen oder die Seitenpfeile navigieren; Textfelder können direkt auf jeder Seite bearbeitet werden. Die linke Steuerung bleibt auf größeren Displays beim Scrollen erreichbar.
3. **Exportieren**: mehrseitige PDF oder PNG der aktuellen Seite, optional transparent. Auf dem iPad PDF teilen oder die heruntergeladene Datei über das Teilen-Menü in GoodNotes öffnen.
4. **Sicherung speichern**: JSON-Datei mit Alphabet, Text, Vorlage und Einstellungen in der Dateien-App aufbewahren. Auf einem anderen Gerät oder nach dem Löschen der Websitedaten über **Sicherung laden** wiederherstellen.
5. **Dokumente archivieren**: Im Papierstudio einen Dokumentnamen eintragen und **Im Archiv speichern** wählen. **Änderungen speichern** aktualisiert denselben Eintrag. Über **Neues Dokument** alle aktuellen Blätter und Textfelder leeren; die bisherigen Blätter werden vorher archiviert. Handschrift und Papiergestaltung bleiben für das neue Dokument erhalten.
   Unter **Archiv** Dokumente suchen, öffnen, umbenennen oder entfernen. Entfernen lässt sich mit **Rückgängig** widerrufen. Beim Öffnen eines anderen Dokuments wird der bisherige Entwurf vorher gesichert. Jedes Dokument enthält Text, Papierart, Vorlage, Schrifteinstellungen, Zufallsverteilung und die Positionen/Größen aller Textfelder und Fortsetzungen. Das Alphabet wird gemeinsam genutzt; Änderungen an Buchstaben gelten auch für erneut geöffnete Dokumente.
   **Archiv sichern** und **Sicherung speichern** laden eine gemeinsame JSON-Datei mit Archiv, aktuellem Entwurf und Alphabet herunter. **Sicherung laden** unter „Meine Handschrift“ stellt sie wieder her. Ältere Sicherungen ohne Archiv bleiben kompatibel und lassen das bestehende Archiv erhalten. Das Archiv ist lokal, ohne Konto oder Cloud-Sync; bis zu 1.000 Dokumente, abhängig vom verfügbaren Browserspeicher.

## Speicherung und Grenzen

- Gespeicherte Varianten, Text, Einstellungen, importiertes Papier und das Archiv bleiben in IndexedDB auf diesem Gerät erhalten, auch nach einem Reload oder Neustart. Falls IndexedDB nicht verfügbar ist, verwendet die App Local Storage. Der Speicherstatus steht am Seitenende. Archivieren und Dokumentwechsel schreiben Archiv und aktuellen Entwurf gemeinsam; bei einem Speicherfehler bleibt das bisherige Dokument geöffnet.
- Bei einem Speichervorgang versucht die App außerdem, dauerhaften Speicher anzufordern; ob der Browser ihn gewährt, entscheidet der Browser. Browserdaten können dennoch durch manuelles Löschen, Privatmodus oder Speicherbereinigung verloren gehen. Eine Sicherungsdatei ist die verlässliche zusätzliche Kopie.
- Die Speicheradresse ist an die Website gebunden: neue Domain, anderer Browser oder anderes Gerät haben einen eigenen Speicher. Es gibt keinen Cloud-Sync.
- Ungespeicherte Striche auf der Zeichenfläche sind ein Entwurf. Erst **Variante speichern** übernimmt sie in die Datenbank.
- Die integrierten Papierarten sind selbst erstellte Vorlagen, keine originalen GoodNotes-Dateien. Eigene Vorlagen werden als PNG/JPG bis 20 MB importiert und auf das gewählte Format skaliert. Passende Grundlinie und passenden Linienabstand mit den Reglern einstellen. PDF-Vorlagen werden noch nicht importiert.
- Texte bis 60.000 UTF-16-Zeichen. Sehr lange Exporte brauchen entsprechend mehr Speicher. Kein Rich Text, keine Schrifterkennung, keine automatische Erkennung von Vorlagenlinien.
- Vorschau (SVG) und PDF speichern eigene Zeichen als Vektorkurven, einschließlich der integrierten Papierlinien. Beim Zoomen werden sie ohne Vergrößern eines Seitenbildes neu dargestellt. Die Strichstärke ist unabhängig von der Schriftgröße einstellbar. Die Schrift besteht aus Zeichenpfaden; sie ist im PDF nicht als Text auswählbar.
- PNGs haben die vierfache Seitenauflösung (A4: 3176 × 4492 Pixel, ungefähr 384 dpi). PNGs bleiben Bilddateien; für verlustfreies Zoomen in GoodNotes die PDF verwenden.
- Importierte Papiervorlagen behalten ihre Bildauflösung. Fehlende Zeichen verwenden eine verfügbare lokale Schreibschrift; im PDF werden nur diese Ersatzzeichen als transparente, hochauflösende Einzelbilder eingebettet. Die selbst gezeichneten Buchstaben bleiben Vektoren.
- Alle App-Dateien einschließlich pdf-lib und dessen MIT-Lizenz liegen im Drop-Ordner. Es gibt keine extern geladenen Fonts, Bibliotheken oder Netzwerkaufrufe der App. Netlify selbst verarbeitet die üblichen Hosting-Anfragen.

## Lokal entwickeln

Mit einem beliebigen statischen HTTP-Server `netlify-drop` bereitstellen. `file://` eignet sich wegen browserabhängiger Speicherregeln nicht als regulärer Betrieb. Das JavaScript ist ohne Framework; die PDF-Bibliothek ist fertig mitgeliefert. Kein npm-Installieren oder Build erforderlich.

## Prüfskripte

Die Browser-Prüfungen in `scripts/` haben eigene Abhängigkeiten in `scripts/package.json` (Playwright, pdf-lib, pngjs, pdfjs-dist, @napi-rs/canvas). Sie liegen bewusst nicht im Wurzelverzeichnis, damit Netlify beim Deploy nichts installiert. Einmalig einrichten:

```bash
cd scripts
npm ci
npx playwright install chromium webkit
```

Unter Linux bei Bedarf `npx playwright install --with-deps chromium webkit`. Danach startet `npm test` (im Ordner `scripts`) den lokalen Server `serve.cjs` auf Port 4173, führt `check.cjs` und alle `*-check.cjs` nacheinander aus und beendet den Server wieder. Einzelne Prüfungen laufen mit `node serve.cjs` in einem Terminal und z. B. `node vector-check.cjs` in einem zweiten. Screenshots und Exporte landen in `output/playwright/`.

Die Leistungsmessung `dots-performance.cjs` ist nicht Teil von `npm test`: erst `node dots-performance.cjs before` (Basiswert), nach einer Änderung `node dots-performance.cjs after` (Prüfungen plus Beschleunigung).

GitHub Actions führt `npm test` bei jedem Push und Pull Request aus (`.github/workflows/checks.yml`).
