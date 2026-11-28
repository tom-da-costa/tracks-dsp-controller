<script lang="ts">
  // French user guide, shown by Help.svelte (which holds the styles). Buttons and tabs are named
  // as the French UI shows them (lib/i18n/fr.ts): keep both in step.
</script>

<section id="help-start">
  <h2>Prise en main</h2>
  <p>
    Cette application pilote un DSP t.racks (408, 206 ou 204) par le réseau. Tous les
    téléphones, tablettes ou ordinateurs du même réseau peuvent l'ouvrir en même temps, avec le
    code d'accès. Tous voient les mêmes réglages et les vumètres en direct.
  </p>
  <ul>
    <li>
      <strong>Les changements sont immédiats :</strong> bouger une commande change le son tout
      de suite. Il n'y a rien à « envoyer ».
    </li>
    <li>
      <strong>Les réglages sont dans le DSP.</strong> Pour garder une configuration après
      l'extinction du DSP ou le rappel d'un autre preset, enregistrez-la dans un preset (voir
      <em>Presets</em>).
    </li>
    <li>Aucune connexion internet n'est nécessaire.</li>
    <li>
      <strong>Serveur :</strong> l'écran de connexion se connecte au serveur qui a servi cette page. Pour en piloter un autre (une appli, ou un autre ordinateur où tourne le serveur), tapez-y son adresse, par ex. <code>192.168.1.20:8080</code> ; les serveurs déjà utilisés sont proposés.
    </li>
  </ul>
</section>

<section id="help-rail">
  <h2>La barre latérale</h2>
  <p>La barre de gauche est la même dans toutes les vues. De haut en bas :</p>
  <dl>
    <dt>»</dt>
    <dd>Déplie la barre pour afficher le nom des onglets ; touchez à nouveau pour la replier.</dd>
    <dt>DSP (point, nom et modèle)</dt>
    <dd>
      Le DSP que pilote cet onglet. Le point est vert quand il est en ligne, rouge quand le DSP ou le serveur est injoignable : un bandeau en haut indique lequel (<em>SERVEUR</em> ou <em>DSP</em>). Les valeurs affichées sont les dernières connues et les commandes sont désactivées jusqu'au retour de la liaison, qui se rétablit toute seule (<em>Réessayer</em> réessaie tout de suite). Touchez-le pour la liste des DSP du serveur (un système principal et une ligne de délai, par exemple) : leur état, leur preset et les modifications non enregistrées ; touchez-en un pour y passer. Chaque onglet du navigateur peut afficher un DSP différent. <em>Prendre la main</em> vaut pour tous les DSP du serveur.
    </dd>
    <dt>Preset</dt>
    <dd>
      Le preset actuellement dans le DSP (U01…U20, ou F00). Un petit point orange signale des
      <em>modifications non enregistrées</em> : les réglages diffèrent du preset enregistré.
      <em>DEMO</em> signifie que le DSP est simulé par le serveur (pas d'appareil). Touchez-le
      pour ouvrir <em>Presets</em>.
    </dd>
    <dt>Les onglets</dt>
    <dd>Une icône par vue (voir <em>Les onglets</em>).</dd>
    <dt>👤 Votre nom</dt>
    <dd>
      Le nom donné à la connexion, tel que les autres le voient. Touchez-le pour ouvrir
      <em>Réglages</em>.
    </dd>
    <dt>✋ Prendre la main</dt>
    <dd>
      Passe les autres appareils en lecture seule pendant que vous travaillez (voir
      <em>À plusieurs en même temps</em>).
    </dd>
    <dt>🔒 Verrouiller l'écran</dt>
    <dd>Passe cet appareil en lecture seule jusqu'à ce que le code d'accès soit saisi.</dd>
    <dt>⛶ Plein écran</dt>
    <dd>Masque les barres du navigateur (téléphones et ordinateurs qui le permettent). Un iPhone ne le permet pas : ajoutez l'appli à l'écran d'accueil (Safari › Partager › Sur l'écran d'accueil) et ouvrez-la depuis son icône.</dd>
  </dl>
</section>

<section id="help-tabs">
  <h2>Les onglets</h2>
  <dl>
    <dt>🎛 Live</dt>
    <dd>
      Pour faire tourner un concert : une tranche par voie avec de grands voyants CLIP / CMP /
      LIM, un vumètre (avec des repères aux seuils du compresseur <em>C</em> et du limiteur
      <em>L</em>, et un trait blanc de crête), le fader de gain et MUTE. Touchez le nom d'une
      voie pour ouvrir sa page.
    </dd>
    <dt>🔗 Liens</dt>
    <dd>
      Regroupe des voies pour qu'elles bougent ensemble, et permet de les renommer (voir
      <em>Liens</em> plus bas).
    </dd>
    <dt>🔀 Matrice</dt>
    <dd>La grille de routage : quelles entrées vont vers chaque sortie.</dd>
    <dt>🎚 Paramètres</dt>
    <dd>
      Un réglage à la fois, sur toutes les voies choisies : Gain, Délai, EQ, Filtres, Comp,
      Limiteur, Gate et GEQ. La plupart s'affichent en une tranche par voie, côte à côte, pour les
      comparer et les régler ensemble. EQ affiche un graphique de fréquence par voie avec la
      liste de ses bandes.
    </dd>
    <dt>🔈 Voies</dt>
    <dd>
      Tout ce qui concerne une voie sur une seule page : son vumètre avec CLIP / CMP / LIM, sa
      courbe de réponse en fréquence (avec les courbes d'autres voies par-dessus si vous les
      choisissez sous <em>Comparer avec</em>), et tous ses réglages. Choisissez la voie dans la
      rangée du haut.
    </dd>
    <dt>▥ Tout-en-un</dt>
    <dd>
      Une colonne par voie avec les réglages choisis dans la rangée du haut, dans l'ordre où l'on
      règle un système : Nom, Lien, Matrice, Filtres, Comp, Limiteur, Gain, EQ, Délai, puis Gate
      et GEQ (entrées seulement, masqués au départ). <strong>Mute</strong> est sous chaque
      vu-mètre. Pratique sur un ordinateur pour voir tout un système.
    </dd>
    <dt>🚨 Trop fort</dt>
    <dd>
      Un grand voyant pour la personne qui règle le volume. Il s'allume dès qu'au moins un
      compresseur ou un limiteur de sortie agit, et indique lesquels. Qu'il clignote de temps
      en temps, ça va ; s'il reste allumé, baissez le volume. Sa luminosité se règle en bas.
    </dd>
    <dt>🧮 Calcul limiteur</dt>
    <dd>
      Calcule des seuils de compresseur et de limiteur qui protègent vos enceintes, à partir du
      gain de l'ampli, de la puissance et de l'impédance de l'enceinte et du type de caisson,
      puis les applique aux sorties choisies (voir <em>Limiteur</em> plus bas). Le seuil est
      arrondi au pas de 0,5 dB du DSP vers le bas, ou vers le haut si vous le choisissez (jusqu'à
      0,5 dB au-dessus de la valeur calculée).
    </dd>
    <dt>☰ Presets</dt>
    <dd>Rappeler et enregistrer les presets du DSP (voir <em>Presets</em>).</dd>
    <dt>⚙ Réglages</dt>
    <dd>
      Fréquence des vumètres, options d'affichage, qui est connecté, l'appareil (voir
      <em>Réglages</em>).
    </dd>
    <dt>❓ Aide</dt>
    <dd>Cette page.</dd>
  </dl>
</section>

<section id="help-channels">
  <h2>Choisir les voies affichées</h2>
  <p>
    Live, Paramètres et Tout-en-un ont une rangée de boutons au-dessus des voies :
    <strong>Toutes</strong>, <strong>In</strong> (entrées seules), <strong>Out</strong>
    (sorties seules), puis un bouton par voie (A–D pour les entrées, 1–8 pour les sorties, avec
    leurs noms). Un bouton allumé signifie que la voie est affichée ; touchez une voie pour
    l'afficher ou la masquer.
  </p>
  <ul>
    <li>
      Sur un téléphone, dans Live et dans les vues en tranches de Paramètres, la rangée se replie
      en un petit bouton en haut à droite des voies, qui indique combien sont affichées (par
      exemple 12/12), pour que les voies commencent en haut de l'écran : touchez-le pour
      ouvrir les boutons, touchez à côté pour refermer.
    </li>
    <li>
      Dans ce panneau, <strong>Largeur</strong> règle la largeur des voies (Live et les vues en
      tranches de Paramètres, en pourcentage de leur largeur habituelle), pour en voir plus à la
      fois ; <strong>Ajuster à l'écran</strong> partage la largeur de l'écran entre les voies
      affichées (et suit une rotation ou un autre choix de voies), ↺ revient à la largeur par
      défaut. Mémorisé sur cet appareil.
    </li>
    <li>
      Live et Paramètres partagent le même choix (et la même largeur), Tout-en-un a le sien ;
      mémorisé sur cet appareil.
    </li>
    <li>
      Chaque voie a sa couleur, la même partout. Les voies liées partagent la couleur de leur
      groupe.
    </li>
    <li>
      Avec <em>Fusionner les voies liées</em> (Réglages), un groupe de voies liées s'affiche comme
      une seule voie, par exemple « Out 1+5 ».
    </li>
    <li>La bande marquée <em>IN | OUT</em> sépare les entrées des sorties.</li>
  </ul>
</section>

<section id="help-controls">
  <h2>Faders, champs et boutons</h2>
  <dl>
    <dt>Faders</dt>
    <dd>
      Un fader ne bouge que si le glissement <strong>commence sur son bouton</strong> : faire
      défiler la page ne le déplace jamais par erreur. − et + avancent d'un pas ; maintenez-les
      pour répéter. Touchez la valeur au-dessus d'un fader pour taper un nombre.
    </dd>
    <dt>Champs numériques</dt>
    <dd>
      − / + changent la valeur d'un pas du DSP (maintenir pour répéter) ; le curseur dessous la
      déplace rapidement ; touchez le nombre pour le taper. Les valeurs sont toujours arrondies à
      ce que le DSP sait enregistrer.
    </dd>
    <dt>Boutons On / Off</dt>
    <dd>Allumé (vert) signifie actif. MUTE et Bypass s'allument en rouge quand ils sont actifs.</dd>
    <dt>Sections</dt>
    <dd>Touchez le titre d'une section (avec la flèche ›) pour la replier ou la déplier.</dd>
    <dt>Graphique d'EQ</dt>
    <dd>
      Chaque bande d'EQ a un point numéroté sur le graphique de fréquence : faites-le glisser
      sur les côtés pour sa fréquence et vers le haut / bas pour son gain ; avec une souris,
      tournez la molette dessus pour changer son Q. Les points gris sont des bandes sans effet
      (désactivées, ou à 0 dB).
    </dd>
    <dt>Badges</dt>
    <dd>
      Un réglage marqué « non vérifié » n'a pas encore été testé sur un vrai DSP 408 ; sur un
      vrai DSP, il ne peut être modifié que si le serveur a été lancé avec
      <code>--experimental</code>.
    </dd>
  </dl>
</section>

<section id="help-together">
  <h2>À plusieurs en même temps</h2>
  <p>
    Par défaut, tout le monde peut tout modifier ; le dernier changement l'emporte, et tout le
    monde le voit aussitôt.
  </p>
  <dl>
    <dt>✋ Prendre la main</dt>
    <dd>
      Tant que vous avez le contrôle, les autres appareils sont en lecture seule (ils indiquent
      qui l'a). Touchez <em>Rendre la main</em> quand vous avez fini. Le contrôle est rendu tout
      seul après un moment sans aucune action de votre part (la barre affiche le temps restant).
    </dd>
    <dt>🔒 Verrouiller l'écran</dt>
    <dd>
      Passe <strong>cet</strong> appareil en lecture seule, pour un téléphone ou un ordinateur
      laissé sans surveillance : tout reste visible (vumètres compris) et la vue ne bouge pas,
      mais on ne peut rien modifier ni changer de vue. <em>Déverrouiller l'écran</em> demande le code
      d'accès. Le verrouillage résiste au rechargement de la page.
    </dd>
    <dt>Maître (Réglages)</dt>
    <dd>
      Une personne peut devenir maître avec <em>Devenir maître</em> dans <em>Réglages › Clients
      connectés</em>. Le maître peut déconnecter un autre client avec <em>Déconnecter</em> (il
      revient à l'écran de connexion et doit retaper le code d'accès) et bloquer les nouvelles
      connexions avec <em>Bloquer les nouvelles connexions</em> : plus personne ne peut se connecter, mais
      les navigateurs déjà connectés le restent. Le blocage prend fin quand le maître touche
      <em>Ne plus être maître</em>, se déconnecte, ou a fermé l'appli depuis 5 minutes. Pour
      exclure quelqu'un : le déconnecter, puis bloquer.
    </dd>
    <dt>👁 Accès en lecture seule</dt>
    <dd>
      Se connecter avec le code de consultation ouvre un accès en lecture seule : tout est affiché (niveaux,
      réglages, presets), rien ne peut être modifié, et le serveur le refuse quoi qu'affiche
      l'écran. Pour un invité, ou un téléphone laissé à la régie. La barre latérale affiche
      <em>Accès en lecture seule</em> au lieu de <em>Prendre la main</em>, et la liste des clients les
      signale. Pour modifier, déconnectez-vous et reconnectez-vous avec le code d'accès. Le code de consultation est affiché dans
      Réglages › Clients connectés (aux sessions ouvertes avec le code d'accès) ; sauf si le
      serveur le fixe (<code>--view-pin</code>), c'est un nouveau code aléatoire à chaque
      démarrage, et <code>--view-pin off</code> désactive l'accès en lecture seule.
    </dd>
  </dl>
</section>

<section id="help-presets">
  <h2>Presets</h2>
  <p>
    Un preset est une configuration complète (tous les réglages de toutes les voies) enregistrée
    dans le DSP lui-même. Le DSP en garde 20 (U01–U20), plus le réglage d'usine (F00).
  </p>
  <dl>
    <dt>Rappeler</dt>
    <dd>
      Charge un preset : <strong>tous les réglages actuels sont remplacés</strong>. Si la
      configuration actuelle a des modifications non enregistrées, elles sont perdues
      (l'application demande d'abord). Cela prend quelques secondes.
    </dd>
    <dt>Enregistrer</dt>
    <dd>
      Enregistre la configuration actuelle dans un emplacement de preset, avec un nom (14
      caractères simples au plus). Cela écrase le contenu de cet emplacement. F00 ne peut pas
      être écrasé.
    </dd>
    <dt>Modifications non enregistrées</dt>
    <dd>
      Signalées par un point orange dans la barre latérale et « ● modifications non enregistrées » sur cette
      page, avec un bouton <em>Enregistrer dans Uxx</em> pour les enregistrer dans le preset en cours.
      La liste en dessous montre ce qui a changé, une ligne par réglage (valeur enregistrée →
      valeur actuelle), avec <em>Annuler</em> pour revenir sur un réglage, ou <em>Tout annuler</em> ;
      rappeler un preset liste ce qui sera perdu. Le serveur connaît le preset enregistré dès
      qu'il l'a vu rappelé ou enregistré : avant, les changements ne peuvent pas être listés.
    </dd>
    <dt>Exporter / importer un .prs</dt>
    <dd>
      Fichiers de preset de l'éditeur officiel t.racks. <em>Exporter la config. en cours</em>
      enregistre la configuration actuelle dans un fichier. <em>Importer un .prs…</em> charge un
      fichier dans le DSP
      (<strong>tous les réglages actuels sont remplacés</strong> ; les sorties sont coupées pendant
      le chargement) et peut l'enregistrer dans un emplacement en même temps. Les niveaux de matrice
      et le bypass du PEQ ne sont pas transportés par ces fichiers.
    </dd>
  </dl>
</section>

<section id="help-settings">
  <h2>Réglages</h2>
  <dl>
    <dt>Vumètres · Fréquence de rafraîchissement</dt>
    <dd>
      La fréquence de mise à jour des vumètres (1 à 10 fois par seconde). Elle s'applique à tous
      les appareils connectés.
    </dd>
    <dt>Vumètres · Bas / haut de l'échelle</dt>
    <dd>
      La plage affichée par tous les vumètres, de −40 à +20 dBu par défaut (+20 dBu est le
      maximum du DSP). Les niveaux, CLIP et les couleurs ne changent pas. Cet appareil uniquement.
    </dd>
    <dt>Vumètres · Segments</dt>
    <dd>
      Affiche les vumètres en barre continue (par défaut) ou en segments de 1, 2, 5 ou 10 dB,
      comme un vumètre à LED : un segment s'allume quand le niveau l'atteint et prend la couleur
      de son haut. Cet appareil uniquement.
    </dd>
    <dt>Affichage · Langue</dt>
    <dd>
      La langue de l'application (aussi sur l'écran de connexion et en haut de cette aide). Elle
      suit celle du navigateur jusqu'à ce qu'on en choisisse une. Les unités et les termes du DSP
      (PEQ, HPF, dBu…) restent tels quels. Cet appareil uniquement.
    </dd>
    <dt>Affichage · Fusionner les voies liées</dt>
    <dd>
      Affiche chaque groupe de voies liées comme une seule voie dans toutes les vues (sauf
      Matrice et Liens). Un changement s'applique à tout le groupe ; les noms et le
      routage restent par voie. Cet appareil uniquement.
    </dd>
    <dt>Affichage · Voyant de signal (SIG)</dt>
    <dd>
      Le niveau au-dessus duquel SIG s'allume (−60 dBu par défaut). Une entrée non branchée lit
      environ −86 dBu. Cet appareil uniquement.
    </dd>
    <dt>Clients connectés</dt>
    <dd>Toutes les personnes qui utilisent l'application en ce moment, et qui a le contrôle.</dd>
    <dt>Appareil</dt>
    <dd>
      L'état, le modèle et le firmware du DSP, et la version de l'application.
      <em>Relire l'appareil</em> relit tous les réglages depuis le DSP. <em>Déconnecter du DSP et
      arrêter</em> arrête proprement le serveur : il libère le DSP (qui n'accepte qu'un
      programme à la fois, par exemple pour utiliser l'éditeur t.racks), puis arrête
      l'application pour tout le monde. Le DSP garde ses réglages. Impossible tant que quelqu'un
      d'autre a le contrôle ou est maître.
    </dd>
    <dt>Ce navigateur</dt>
    <dd>
      <em>Se déconnecter</em> quitte l'application sur cet appareil seulement ; le serveur continue de
      tourner.
    </dd>
  </dl>
</section>

<section id="help-audio">
  <h2>Les réglages audio expliqués</h2>
  <p>
    Chaque <strong>entrée</strong> (A–D) est un signal qui arrive ; chaque
    <strong>sortie</strong> (1–8) alimente un amplificateur. Le DSP traite les entrées, les
    envoie vers les sorties (routage), puis traite à nouveau chaque sortie.
  </p>
  <dl>
    <dt>Niveaux et vumètres (dBu)</dt>
    <dd>
      Les niveaux sont en dBu. Les vumètres montent jusqu'à +20 dBu, le maximum que le DSP
      supporte : <strong>CLIP</strong> s'allume quand un signal l'atteint et sature. Couleurs :
      vert jusqu'à 0 dBu, jaune jusqu'à +6, orange jusqu'à +12, rouge au-delà. Le niveau passe
      en orange quand un compresseur agit, en orange foncé quand un limiteur agit, en rouge en
      cas de clip. <strong>SIG</strong> s'allume tant qu'une voie porte du signal (au-dessus de
      −60 dBu, réglable dans Réglages).
    </dd>
    <dt>Gain</dt>
    <dd>Le volume de la voie, en dB (−60 à +12). 0 dB laisse le niveau tel quel.</dd>
    <dt>Mute</dt>
    <dd>Coupe le son de la voie (ses réglages sont conservés).</dd>
    <dt>Phase (Ø)</dt>
    <dd>
      Inverse la polarité du signal. Utile quand deux enceintes (par exemple un sub et un
      satellite) s'annulent autour de leur fréquence de coupure : essayez, et gardez ce qui sonne
      le plus plein.
    </dd>
    <dt>Délai (retard)</dt>
    <dd>
      Retarde le signal, réglé en millisecondes ou en mètres (la distance parcourue par le son
      pendant ce temps). Sert à aligner des enceintes placées à des distances différentes du
      public, pour que leurs sons arrivent ensemble.
    </dd>
    <dt>Filtres (passe-haut / passe-bas)</dt>
    <dd>
      Un filtre <strong>passe-haut</strong> (high-pass) enlève ce qui est sous sa fréquence (par
      exemple les graves envoyés à un petit satellite) ; un <strong>passe-bas</strong>
      (low-pass) enlève ce qui est au-dessus (par exemple les aigus envoyés à un sub). Ensemble,
      ils répartissent le son entre les enceintes (filtrage actif). La pente indique la raideur
      de la coupure (6 à 48 dB par octave) et sa forme : BW (Butterworth), BL (Bessel) ou LR
      (Linkwitz-Riley, le choix habituel pour raccorder deux enceintes). <em>Off</em> désactive
      le filtre.
    </dd>
    <dt>EQ (égaliseur paramétrique)</dt>
    <dd>
      Jusqu'à 8 bandes sur les entrées, 9 sur les sorties, chacune renforçant ou atténuant une
      plage de fréquences. Une bande a un <strong>type</strong> (Peak : une cloche autour de sa
      fréquence ; Low / High Shelf : tout ce qui est en dessous / au-dessus ; LP / HP :
      passe-bas / passe-haut ; Allpass : ne change que la phase), une
      <strong>fréquence</strong>, un <strong>gain</strong> (+ renforce, − atténue) et un
      <strong>Q</strong> (la largeur : un Q élevé est étroit, un Q faible est large). Chaque
      bande peut être désactivée, et <em>Bypass</em> désactive tout l'EQ.
    </dd>
    <dt>GEQ (égaliseur graphique)</dt>
    <dd>Sur les entrées : 31 bandes fixes, une par tiers d'octave, chacune avec son gain.</dd>
    <dt>Compresseur</dt>
    <dd>
      Sur les sorties. Au-dessus de son <strong>seuil</strong> (threshold), il réduit le niveau
      selon son <strong>ratio</strong> (par exemple 1:4 : 4 dB de plus en entrée donnent 1 dB de
      plus en sortie ; <em>Limit</em> est le plus fort). L'<strong>attaque</strong> (attack) est
      sa vitesse de réaction, le <strong>relâchement</strong> (release) sa vitesse de retour, le
      <strong>knee</strong> la douceur de son entrée en action. CMP s'allume pendant qu'il agit.
    </dd>
    <dt>Limiteur</dt>
    <dd>
      Sur les sorties : un plafond que le niveau de sortie ne dépasse pas, pour protéger amplis
      et enceintes. LIM s'allume pendant qu'il agit ; s'il reste allumé, le système est trop
      poussé. L'onglet <em>Calcul limiteur</em> calcule un seuil sûr pour vos enceintes.
    </dd>
    <dt>Noise gate</dt>
    <dd>
      Sur les entrées : ferme (coupe) la voie tant que son niveau est sous le seuil, par exemple
      pour supprimer le bruit de fond d'un micro entre deux phrases. Attack, hold et release
      règlent la vitesse d'ouverture, la durée d'ouverture minimale et la vitesse de fermeture.
    </dd>
    <dt>Matrice (routage)</dt>
    <dd>
      Quelles entrées alimentent chaque sortie. Touchez une case pour connecter ou déconnecter
      une entrée d'une sortie.
    </dd>
    <dt>Liens</dt>
    <dd>
      Les voies liées bougent ensemble : un changement sur l'une s'applique à toutes (gain,
      mute, EQ, filtres, dynamiques, delay…), sauf leurs noms et leur routage. Au moment du lien,
      la première voie (le plus petit numéro) est la maîtresse : ses réglages sont copiés sur
      les autres. Sert aux paires stéréo (par exemple les subs gauche et droit). Sous les voies,
      <em>Noms des voies</em> permet de renommer chacune en même temps.
    </dd>
  </dl>
</section>

<section id="help-safety">
  <h2>Bonnes habitudes</h2>
  <ul>
    <li>
      Enregistrez votre configuration dans un preset dès qu'elle sonne bien ; gardez un preset
      libre pour faire des essais.
    </li>
    <li>Baissez le volume avant de gros changements de filtres, d'EQ ou de routage.</li>
    <li>
      Surveillez l'onglet Trop fort ou les voyants LIM : un limiteur qui reste allumé veut dire
      qu'il faut baisser.
    </li>
    <li>
      Verrouillez l'écran d'un appareil laissé sans surveillance, ou prenez le contrôle pendant
      vos réglages.
    </li>
  </ul>
</section>
