<script lang="ts">
  // German user guide, shown by Help.svelte (which holds the styles). Buttons and tabs are named
  // as the German UI shows them (lib/i18n/de.ts): keep both in step.
</script>

<section id="help-start">
  <h2>Erste Schritte</h2>
  <p>
    Diese App steuert einen t.racks DSP (408, 206 oder 204) über das Netzwerk. Alle Handys,
    Tablets und Computer im selben Netzwerk können sie gleichzeitig öffnen, mit dem
    Zugangscode. Alle sehen dieselben Einstellungen und die Pegelanzeigen live.
  </p>
  <ul>
    <li>
      <strong>Änderungen wirken sofort:</strong> Ein Regler ändert den Klang unmittelbar. Es
      muss nichts „gesendet“ werden.
    </li>
    <li>
      <strong>Die Einstellungen liegen im DSP.</strong> Um ein Setup zu behalten, wenn der DSP
      ausgeschaltet oder ein anderes Preset geladen wird, speichern Sie es in einem Preset (siehe
      <em>Presets</em>).
    </li>
    <li>Es wird keine Internetverbindung benötigt.</li>
  </ul>
</section>

<section id="help-rail">
  <h2>Die Seitenleiste</h2>
  <p>Die Leiste links ist in jeder Ansicht gleich. Von oben nach unten:</p>
  <dl>
    <dt>»</dt>
    <dd>Klappt die Leiste auf, um die Namen der Tabs zu zeigen; nochmals tippen zum Einklappen.</dd>
    <dt>DSP (Punkt, Name und Modell)</dt>
    <dd>
      Der DSP, den dieser Tab steuert. Der Punkt ist grün, wenn er online ist, und rot, wenn der DSP oder der Server nicht erreichbar ist: Ein Banner oben zeigt dann, welcher (<em>SERVER</em> oder <em>DSP</em>). Die angezeigten Werte sind die zuletzt bekannten, und die Bedienelemente sind gesperrt, bis die Verbindung von selbst zurückkommt (<em>Jetzt erneut versuchen</em> versucht es sofort). Antippen öffnet die Liste der DSPs des Servers (etwa ein Hauptsystem und eine Delay-Line): Status, Preset und ungespeicherte Änderungen; einen antippen wechselt zu ihm. Jeder Browser-Tab kann einen anderen DSP zeigen. <em>Kontrolle übernehmen</em> gilt für alle DSPs des Servers.
    </dd>
    <dt>Preset</dt>
    <dd>
      Das aktuell im DSP geladene Preset (U01…U20 oder F00). Ein kleiner orangefarbener Punkt
      bedeutet <em>ungespeicherte Änderungen</em>: Die Einstellungen weichen vom gespeicherten
      Preset ab. <em>DEMO</em> bedeutet, dass der DSP vom Server simuliert wird (kein Gerät).
      Antippen öffnet <em>Presets</em>.
    </dd>
    <dt>Die Tabs</dt>
    <dd>Ein Symbol pro Ansicht (siehe <em>Die Tabs</em>).</dd>
    <dt>👤 Ihr Name</dt>
    <dd>
      Der beim Anmelden angegebene Name, so wie die anderen ihn sehen. Antippen öffnet
      <em>Einstellungen</em>.
    </dd>
    <dt>✋ Kontrolle übernehmen</dt>
    <dd>
      Schaltet die anderen Geräte auf „nur lesen“, solange Sie arbeiten (siehe <em>Zu
      mehreren gleichzeitig</em>).
    </dd>
    <dt>🔒 Bildschirm sperren</dt>
    <dd>Schaltet dieses Gerät auf „nur lesen“, bis der Zugangscode eingegeben wird.</dd>
    <dt>⛶ Vollbild</dt>
    <dd>Blendet die Leisten des Browsers aus (Handys und Computer, die es erlauben). Das iPhone erlaubt es nicht: die App zum Home-Bildschirm hinzufügen (Safari › Teilen › Zum Home-Bildschirm) und über ihr Symbol öffnen.</dd>
  </dl>
</section>

<section id="help-tabs">
  <h2>Die Tabs</h2>
  <dl>
    <dt>🎛 Live</dt>
    <dd>
      Für den Betrieb während einer Show: ein Kanalzug pro Kanal mit großen CLIP / CMP / LIM
      Anzeigen, einer Pegelanzeige (mit Markierungen an den Schwellen von Kompressor <em>C</em>
      und Limiter <em>L</em> und einer weißen Spitzenwertlinie), dem Gain-Fader und MUTE. Den
      Kanalnamen antippen öffnet die Seite des Kanals.
    </dd>
    <dt>🔗 Link</dt>
    <dd>
      Gruppiert Kanäle, damit sie sich gemeinsam bewegen, und benennt sie um (siehe
      <em>Link</em> unten).
    </dd>
    <dt>🔀 Matrix</dt>
    <dd>Das Routing-Raster: welche Eingänge auf welchen Ausgang gehen.</dd>
    <dt>🎚 Parameter</dt>
    <dd>
      Eine Einstellung nach der anderen, auf allen gewählten Kanälen: Gain, Delay, EQ, Filter,
      Comp, Limiter, Gate und GEQ. Die meisten erscheinen als ein Kanalzug pro Kanal nebeneinander,
      um sie zu vergleichen und gemeinsam einzustellen. EQ zeigt pro Kanal einen Frequenzgang mit
      seiner Bandliste.
    </dd>
    <dt>🔈 Kanäle</dt>
    <dd>
      Alles zu einem Kanal auf einer Seite: Pegelanzeige mit CLIP / CMP / LIM, Frequenzgang (mit
      den Kurven anderer Kanäle darüber, wenn Sie sie unter <em>Vergleichen mit</em> wählen) und
      alle Einstellungen. Den Kanal in der oberen Reihe wählen.
    </dd>
    <dt>▥ Gesamtansicht</dt>
    <dd>
      Eine Spalte pro Kanal mit den Einstellungen, die oben gewählt sind, in der Reihenfolge, in
      der man ein System einstellt: Name, Link, Matrix, Filter, Comp, Limiter, Gain, EQ, Delay,
      dann Gate und GEQ (nur Eingänge, anfangs ausgeblendet). <strong>Mute</strong> steht unter
      jeder Pegelanzeige. Praktisch am Computer, um ein ganzes System zu überblicken.
    </dd>
    <dt>🚨 Zu laut</dt>
    <dd>
      Eine große Anzeige für die Person, die die Lautstärke regelt. Sie leuchtet, sobald
      mindestens ein Kompressor oder Limiter eines Ausgangs arbeitet, und nennt welche.
      Gelegentliches Aufblinken ist in Ordnung; bleibt sie an, die Lautstärke senken. Die
      Helligkeit wird unten eingestellt.
    </dd>
    <dt>🧮 Limiter-Rechner</dt>
    <dd>
      Berechnet Kompressor- und Limiter-Schwellen, die Ihre Lautsprecher schützen, aus der
      Verstärkung der Endstufe, Leistung und Impedanz des Lautsprechers und der Gehäuseart, und
      überträgt sie auf die gewählten Ausgänge (siehe <em>Limiter</em> unten). Die Schwelle wird
      auf den 0,5-dB-Schritt des DSP abgerundet oder, wenn gewählt, aufgerundet (bis zu 0,5 dB
      über dem berechneten Wert).
    </dd>
    <dt>☰ Presets</dt>
    <dd>Presets des DSP laden und speichern (siehe <em>Presets</em>).</dd>
    <dt>⚙ Einstellungen</dt>
    <dd>
      Aktualisierungsrate der Anzeigen, Anzeigeoptionen, wer verbunden ist, das Gerät (siehe
      <em>Einstellungen</em>).
    </dd>
    <dt>❓ Hilfe</dt>
    <dd>Diese Seite.</dd>
  </dl>
</section>

<section id="help-channels">
  <h2>Angezeigte Kanäle wählen</h2>
  <p>
    Live, Parameter und Gesamtansicht haben über den Kanälen eine Reihe von Tasten:
    <strong>Alle</strong>, <strong>In</strong> (nur Eingänge), <strong>Out</strong> (nur
    Ausgänge), dann eine Taste pro Kanal (A–D für die Eingänge, 1–8 für die Ausgänge, mit ihren
    Namen). Eine leuchtende Taste bedeutet, dass der Kanal angezeigt wird; einen Kanal antippen
    blendet ihn ein oder aus.
  </p>
  <ul>
    <li>
      Auf einem Smartphone klappt die Reihe in Live und in den Streifen-Ansichten von Parameter
      zu einer kleinen Taste oben rechts über den Kanälen zusammen, die zeigt, wie viele
      angezeigt werden (z. B. 12/12), damit die Kanäle oben am Bildschirm beginnen: antippen
      öffnet die Tasten, daneben tippen schließt sie.
    </li>
    <li>
      In diesem Feld stellt <strong>Breite</strong> die Breite der Kanäle ein (Live und die
      Streifen-Ansichten von Parameter, in Prozent ihrer üblichen Breite), um mehr davon
      gleichzeitig zu sehen; <strong>An Bildschirm anpassen</strong> teilt die Bildschirmbreite auf die
      angezeigten Kanäle auf (und folgt einer Drehung oder einer anderen Auswahl), ↺ stellt
      die Standardbreite wieder her. Wird auf diesem Gerät gespeichert.
    </li>
    <li>
      Live und Parameter teilen eine Auswahl (und eine Breite), die Gesamtansicht hat seine eigene; auf
      diesem Gerät gespeichert.
    </li>
    <li>
      Jeder Kanal hat seine eigene Farbe, überall dieselbe. Verlinkte Kanäle teilen die Farbe
      ihrer Gruppe.
    </li>
    <li>
      Mit <em>Verlinkte Kanäle zusammenfassen</em> (Einstellungen) erscheint eine Gruppe verlinkter Kanäle als
      ein Kanal, z. B. „Out 1+5“.
    </li>
    <li>Das Band mit <em>IN | OUT</em> trennt die Eingänge von den Ausgängen.</li>
  </ul>
</section>

<section id="help-controls">
  <h2>Fader, Felder und Tasten</h2>
  <dl>
    <dt>Fader</dt>
    <dd>
      Ein Fader bewegt sich nur, wenn das Ziehen <strong>auf seinem Knopf beginnt</strong>;
      Scrollen verstellt ihn also nie versehentlich. − und + gehen einen Schritt; gedrückt
      halten wiederholt. Den Wert über einem Fader antippen, um eine Zahl einzugeben.
    </dd>
    <dt>Zahlenfelder</dt>
    <dd>
      − / + ändern den Wert um einen Schritt des DSP (gedrückt halten wiederholt); der Schieber
      darunter verstellt ihn schnell; die Zahl antippen, um sie einzugeben. Werte werden immer
      auf das gerundet, was der DSP speichern kann.
    </dd>
    <dt>Ein / Aus Tasten</dt>
    <dd>Leuchtend (grün) heißt an. MUTE und Bypass leuchten rot, wenn sie aktiv sind.</dd>
    <dt>Abschnitte</dt>
    <dd>Den Titel eines Abschnitts (mit dem Pfeil ›) antippen, um ihn ein- oder auszuklappen.</dd>
    <dt>EQ-Grafik</dt>
    <dd>
      Jedes EQ-Band hat einen nummerierten Punkt im Frequenzgang: seitlich ziehen für die
      Frequenz, nach oben / unten für die Verstärkung; mit einer Maus das Mausrad darüber drehen,
      um den Q-Wert zu ändern. Graue Punkte sind Bänder ohne Wirkung (aus oder bei 0 dB).
    </dd>
    <dt>Kennzeichen</dt>
    <dd>
      Eine als „ungeprüft“ markierte Einstellung wurde noch nicht an einem echten DSP 408
      getestet; an einem echten DSP lässt sie sich nur ändern, wenn der Server mit
      <code>--experimental</code> gestartet wurde.
    </dd>
  </dl>
</section>

<section id="help-together">
  <h2>Zu mehreren gleichzeitig</h2>
  <p>
    Standardmäßig kann jeder alles ändern; die letzte Änderung gilt, und alle sehen sie sofort.
  </p>
  <dl>
    <dt>✋ Kontrolle übernehmen</dt>
    <dd>
      Solange Sie die Kontrolle haben, sind die anderen Geräte auf „nur lesen“ (sie zeigen, wer
      sie hat). <em>Kontrolle abgeben</em> antippen, wenn Sie fertig sind. Die Kontrolle wird nach
      einer Weile ohne Aktion von Ihnen automatisch freigegeben (die Leiste zeigt die
      verbleibende Zeit).
    </dd>
    <dt>🔒 Bildschirm sperren</dt>
    <dd>
      Schaltet <strong>dieses</strong> Gerät auf „nur lesen“, für ein unbeaufsichtigtes Handy
      oder einen Computer: Alles bleibt sichtbar (auch die Anzeigen) und die Ansicht bleibt, wo
      sie ist, aber nichts kann geändert oder gewechselt werden. <em>Bildschirm entsperren</em> fragt
      nach dem Zugangscode. Die Sperre bleibt auch nach einem Neuladen bestehen.
    </dd>
    <dt>Master (Einstellungen)</dt>
    <dd>
      Eine Person kann unter <em>Einstellungen › Verbundene Clients</em> mit <em>Master werden</em>
      Master werden. Der Master kann einen anderen Client mit <em>Trennen</em> hinauswerfen (er
      landet wieder auf der Anmeldeseite und muss den Zugangscode erneut eingeben) und mit
      <em>Neue Verbindungen sperren</em> neue Verbindungen sperren: Niemand kann sich mehr anmelden,
      bereits verbundene Browser bleiben verbunden. Die Sperre endet, wenn der Master <em>Nicht mehr
      Master sein</em> antippt, sich abmeldet oder die App seit 5 Minuten geschlossen hat. Um
      jemanden auszuschließen: erst trennen, dann sperren.
    </dd>
    <dt>👁 Nur-Lese-Zugang</dt>
    <dd>
      Die Anmeldung mit dem Ansichtscode öffnet einen Nur-Lese-Zugang: alles wird angezeigt (Pegel, Einstellungen,
      Presets), nichts lässt sich ändern, und der Server lehnt es ab, was auch immer der
      Bildschirm zeigt. Für einen Gast oder ein am FOH liegendes Telefon. Die Seitenleiste
      zeigt <em>Nur-Lese-Zugang</em> statt <em>Kontrolle übernehmen</em>, und die Client-Liste
      kennzeichnet diese Clients. Um etwas zu ändern, abmelden und mit dem Zugangscode
      anmelden. Der Ansichtscode steht unter Einstellungen › Verbundene Clients (für Sitzungen mit
      dem Zugangscode); legt ihn der Server nicht fest (<code>--view-pin</code>), ist er bei
      jedem Start ein neuer Zufallscode, und <code>--view-pin off</code> schaltet den
      Nur-Lese-Zugang ab.
    </dd>
  </dl>
</section>

<section id="help-presets">
  <h2>Presets</h2>
  <p>
    Ein Preset ist ein komplettes Setup (alle Einstellungen aller Kanäle), gespeichert im DSP
    selbst. Der DSP speichert 20 davon (U01–U20) plus die Werkseinstellung (F00).
  </p>
  <dl>
    <dt>Laden</dt>
    <dd>
      Lädt ein Preset: <strong>alle aktuellen Einstellungen werden ersetzt</strong>. Hat das
      aktuelle Setup ungespeicherte Änderungen, gehen sie verloren (die App fragt vorher). Das
      dauert einige Sekunden.
    </dd>
    <dt>Speichern</dt>
    <dd>
      Speichert das aktuelle Setup in einen Preset-Platz, mit einem Namen (höchstens 14 einfache
      Zeichen). Der bisherige Inhalt dieses Platzes wird überschrieben. F00 kann nicht
      überschrieben werden.
    </dd>
    <dt>Ungespeicherte Änderungen</dt>
    <dd>
      Angezeigt durch einen orangefarbenen Punkt in der Seitenleiste und „● ungespeicherte Änderungen“
      auf dieser Seite, mit einer Taste <em>In Uxx speichern</em>, um sie ins aktuelle Preset zu
      speichern. Die Liste darunter zeigt, was sich geändert hat, eine Zeile pro Einstellung
      (gespeicherter Wert → aktueller Wert), mit <em>Rückgängig</em>, um eine Einstellung
      zurückzusetzen, oder <em>Alle rückgängig</em>; beim Abrufen eines Presets wird aufgelistet, was
      verloren geht. Der Server kennt das gespeicherte Preset, sobald er es abgerufen oder
      gespeichert gesehen hat: vorher lassen sich die Änderungen nicht auflisten.
    </dd>
    <dt>.prs exportieren / importieren</dt>
    <dd>
      Preset-Dateien des offiziellen t.racks-Editors. <em>Aktuelles Setup exportieren</em> speichert das
      aktuelle Setup in eine Datei. <em>.prs importieren…</em> lädt eine Datei in den DSP (<strong>alle
      aktuellen Einstellungen werden ersetzt</strong>; die Ausgänge sind während des Ladens stumm)
      und kann sie gleichzeitig in einen Preset-Platz speichern. Matrix-Pegel und der PEQ-Bypass
      sind in diesen Dateien nicht enthalten.
    </dd>
  </dl>
</section>

<section id="help-settings">
  <h2>Einstellungen</h2>
  <dl>
    <dt>Pegelanzeigen · Aktualisierungsrate</dt>
    <dd>
      Wie oft die Pegelanzeigen aktualisiert werden (1 bis 10 Mal pro Sekunde). Gilt für alle
      verbundenen Geräte.
    </dd>
    <dt>Pegelanzeigen · Skala unten / oben</dt>
    <dd>
      Der Bereich aller Pegelanzeigen, standardmäßig −40 bis +20 dBu (+20 dBu ist das Maximum des
      DSP). Pegel, CLIP und Farben ändern sich nicht. Nur dieses Gerät.
    </dd>
    <dt>Pegelanzeigen · Segmente</dt>
    <dd>
      Zeigt die Pegelanzeigen als durchgehenden Balken (Standard) oder in Segmenten von 1, 2, 5
      oder 10 dB wie eine LED-Anzeige: Ein Segment leuchtet, sobald der Pegel es erreicht, in der
      Farbe seiner Oberkante. Nur dieses Gerät.
    </dd>
    <dt>Anzeige · Sprache</dt>
    <dd>
      Die Sprache der App (auch auf dem Anmeldebildschirm und oben in dieser Hilfe). Sie folgt
      der des Browsers, bis eine gewählt wird. Einheiten und DSP-Begriffe (PEQ, HPF, dBu…)
      bleiben unverändert. Nur dieses Gerät.
    </dd>
    <dt>Anzeige · Verlinkte Kanäle zusammenfassen</dt>
    <dd>
      Zeigt jede Gruppe verlinkter Kanäle als einen Kanal in allen Ansichten (außer Matrix und
      Link). Eine Änderung gilt für die ganze Gruppe; Namen und Routing bleiben pro
      Kanal. Nur dieses Gerät.
    </dd>
    <dt>Anzeige · Signalanzeige (SIG)</dt>
    <dd>
      Der Pegel, ab dem SIG leuchtet (Standard −60 dBu). Ein nicht angeschlossener Eingang zeigt
      etwa −86 dBu. Nur dieses Gerät.
    </dd>
    <dt>Verbundene Clients</dt>
    <dd>Alle, die die App gerade benutzen, und wer die Kontrolle hat.</dd>
    <dt>Gerät</dt>
    <dd>
      Status, Modell und Firmware des DSP und die Version der App. <em>Vom Gerät neu lesen</em>
      liest alle Einstellungen neu aus dem DSP. <em>Vom DSP trennen und beenden</em> beendet
      den Server sauber: Er gibt den DSP frei (der nur ein Programm gleichzeitig annimmt, z. B.
      für den t.racks-Editor) und beendet dann die App für alle. Der DSP behält seine
      Einstellungen. Nicht möglich, solange jemand anderes die Kontrolle hat oder Master ist.
    </dd>
    <dt>Dieser Browser</dt>
    <dd><em>Abmelden</em> meldet nur dieses Gerät ab; der Server läuft weiter.</dd>
  </dl>
</section>

<section id="help-audio">
  <h2>Die Audio-Einstellungen erklärt</h2>
  <p>
    Jeder <strong>Eingang</strong> (A–D) ist ein ankommendes Signal; jeder
    <strong>Ausgang</strong> (1–8) speist eine Endstufe. Der DSP bearbeitet die Eingänge,
    verteilt sie auf die Ausgänge (Routing) und bearbeitet dann jeden Ausgang noch einmal.
  </p>
  <dl>
    <dt>Pegel und Anzeigen (dBu)</dt>
    <dd>
      Pegel werden in dBu angegeben. Die Anzeigen reichen bis +20 dBu, dem Maximum des DSP:
      <strong>CLIP</strong> leuchtet, wenn ein Signal es erreicht und verzerrt. Farben: grün
      bis 0 dBu, gelb bis +6, orange bis +12, rot darüber. Der Pegel wird orange, wenn ein
      Kompressor arbeitet, dunkelorange, wenn ein Limiter arbeitet, rot bei Clipping.
      <strong>SIG</strong> leuchtet, solange ein Kanal Signal führt (über −60 dBu, einstellbar
      unter Einstellungen).
    </dd>
    <dt>Gain</dt>
    <dd>Die Lautstärke des Kanals in dB (−60 bis +12). 0 dB lässt den Pegel unverändert.</dd>
    <dt>Mute</dt>
    <dd>Schaltet den Kanal stumm (seine Einstellungen bleiben erhalten).</dd>
    <dt>Phase (Ø)</dt>
    <dd>
      Kehrt die Polarität des Signals um. Nützlich, wenn sich zwei Lautsprecher (z. B. Subwoofer
      und Topteil) im Bereich der Trennfrequenz auslöschen: ausprobieren und das behalten, was
      voller klingt.
    </dd>
    <dt>Delay (Verzögerung)</dt>
    <dd>
      Verzögert das Signal, einstellbar in Millisekunden oder in Metern (die Strecke, die der
      Schall in dieser Zeit zurücklegt). Dient dazu, unterschiedlich weit vom Publikum entfernte
      Lautsprecher so abzustimmen, dass ihr Schall gleichzeitig ankommt.
    </dd>
    <dt>Filter (Hochpass / Tiefpass)</dt>
    <dd>
      Ein <strong>Hochpass</strong> (high-pass) entfernt alles unterhalb seiner Frequenz (z. B.
      Bässe, die zu einem kleinen Topteil gehen); ein <strong>Tiefpass</strong> (low-pass)
      entfernt alles darüber (z. B. Höhen, die zu einem Subwoofer gehen). Zusammen verteilen sie
      den Klang auf die Lautsprecher (Frequenzweiche). Die Flankensteilheit (slope) sagt, wie
      steil abgeschnitten wird (6 bis 48 dB pro Oktave), und die Charakteristik: BW
      (Butterworth), BL (Bessel) oder LR (Linkwitz-Riley, die übliche Wahl, um zwei
      Lautsprecher zu verbinden). <em>Aus</em> schaltet den Filter ab.
    </dd>
    <dt>EQ (parametrischer Equalizer)</dt>
    <dd>
      Bis zu 8 Bänder auf den Eingängen, 9 auf den Ausgängen, die jeweils einen
      Frequenzbereich anheben oder absenken. Ein Band hat einen <strong>Typ</strong> (Peak:
      eine Glocke um seine Frequenz; Low / High Shelf: alles darunter / darüber; LP / HP:
      Tiefpass / Hochpass; Allpass: ändert nur die Phase), eine <strong>Frequenz</strong>,
      eine <strong>Verstärkung</strong> (+ hebt an, − senkt ab) und einen <strong>Q</strong>
      (die Breite: hoher Q ist schmal, niedriger Q ist breit). Jedes Band kann abgeschaltet
      werden, und <em>Bypass</em> schaltet den ganzen EQ ab.
    </dd>
    <dt>GEQ (grafischer Equalizer)</dt>
    <dd>Auf den Eingängen: 31 feste Bänder, eines pro Terz, jedes mit eigener Verstärkung.</dd>
    <dt>Kompressor</dt>
    <dd>
      Auf den Ausgängen. Oberhalb seiner <strong>Schwelle</strong> (threshold) senkt er den
      Pegel um sein <strong>Verhältnis</strong> (ratio) ab (z. B. 1:4: 4 dB mehr am Eingang
      ergeben 1 dB mehr am Ausgang; <em>Limit</em> ist das stärkste). <strong>Attack</strong>
      ist, wie schnell er reagiert, <strong>Release</strong>, wie schnell er wieder loslässt,
      <strong>Knee</strong>, wie sanft er einsetzt. CMP leuchtet, solange er arbeitet.
    </dd>
    <dt>Limiter</dt>
    <dd>
      Auf den Ausgängen: eine Obergrenze, die der Ausgangspegel nicht überschreitet, zum Schutz
      von Endstufen und Lautsprechern. LIM leuchtet, solange er arbeitet; bleibt es an, wird
      die Anlage zu stark gefahren. Der Tab <em>Limiter-Rechner</em> berechnet eine sichere
      Schwelle für Ihre Lautsprecher.
    </dd>
    <dt>Noise Gate</dt>
    <dd>
      Auf den Eingängen: schließt (stummt) den Kanal, solange sein Pegel unter der Schwelle
      liegt, z. B. um das Grundrauschen eines Mikrofons zwischen zwei Sätzen zu entfernen.
      Attack, Hold und Release bestimmen, wie schnell es öffnet, wie lange es mindestens offen
      bleibt und wie schnell es schließt.
    </dd>
    <dt>Matrix (Routing)</dt>
    <dd>
      Welche Eingänge jeden Ausgang speisen. Ein Feld antippen, um einen Eingang mit einem
      Ausgang zu verbinden oder zu trennen.
    </dd>
    <dt>Link (Verlinkung)</dt>
    <dd>
      Verlinkte Kanäle bewegen sich gemeinsam: Eine Änderung an einem gilt für alle (Gain, Mute,
      EQ, Filter, Dynamik, Delay…), außer Namen und Routing. Beim Verlinken ist der erste Kanal
      (die kleinste Nummer) der Master: Seine Einstellungen werden auf die anderen kopiert. Für
      Stereopaare (z. B. linker und rechter Subwoofer). Unter den Kanälen lässt sich mit
      <em>Kanalnamen</em> jeder Kanal gleich umbenennen.
    </dd>
  </dl>
</section>

<section id="help-safety">
  <h2>Gute Gewohnheiten</h2>
  <ul>
    <li>
      Speichern Sie Ihr Setup in einem Preset, sobald es gut klingt; halten Sie ein freies
      Preset für Experimente bereit.
    </li>
    <li>Senken Sie die Lautstärke vor größeren Änderungen an Filtern, EQ oder Routing.</li>
    <li>
      Achten Sie auf den Tab Zu laut oder die LIM-Anzeigen: Ein Limiter, der dauerhaft
      leuchtet, heißt leiser machen.
    </li>
    <li>
      Sperren Sie den Bildschirm eines unbeaufsichtigten Geräts, oder übernehmen Sie die
      Kontrolle, während Sie einstellen.
    </li>
  </ul>
</section>
