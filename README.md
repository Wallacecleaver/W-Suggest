<p align="center">
  <img src="https://i.imgur.com/DHKJ7dT.png" alt="Logo W Suggest" width="150" />
</p>

<h1 align="center">W Suggest</h1>

<div align="center">

  <a href="https://github.com/Wallacecleaver/W-Suggest">
      <img src="https://img.shields.io/badge/statut-actif-brightgreen?logo=github" alt="Statut">
  </a>
  <a href="https://github.com/Wallacecleaver/W-Suggest/releases">
      <img src="https://img.shields.io/github/v/tag/Wallacecleaver/W-Suggest?logo=github" alt="Dernière version">
  </a>
  <a href="https://github.com/Wallacecleaver/W-Suggest/stargazers">
      <img src="https://img.shields.io/github/stars/Wallacecleaver/W-Suggest?style=flat&logo=github" alt="Étoiles GitHub">
  </a>
  <a href="https://github.com/Wallacecleaver/W-Suggest/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/Wallacecleaver/W-Suggest" alt="Licence">
  </a>

</div>
<br></br>

# ✨ Qu'est-ce que W Suggest ?

**W Suggest** est un addon Stremio qui récupère des recommandations similaires de films et séries télévisées depuis de multiples sources, regroupées au même endroit.

<p align="center">
  <img src="https://i.imgur.com/BW9xWHU.jpeg" alt="exemple1" width="700" />
</p>

<p align="center">
  <img src="https://i.imgur.com/KBBGfvi.jpeg" alt="exemple2" width="700" />
</p>

<p align="center">
  <img src="https://i.imgur.com/nuXpDyO.png" alt="exemple2" width="700" />
</p>

# Fonctionnalités

- Récupère des recommandations depuis plusieurs sources différentes :
  - **TMDB** (y compris les collections TMDB)
  - **Trakt**
  - **Simkl**
  - **Watchmode**
  - **Gemini IA**
  - **Tastedive**
- Recherche de recommandations par :
  - **Identifiant IMDb (IMDb ID)**
  - **Identifiant Kitsu (Kitsu ID)**
  - **Identifiant TMDB (TMDB ID)**
  - **Identifiant Trakt (Trakt ID)**
  - **Titre du film ou de la série**
- Prise en charge des affiches **RPDB** (Rating Poster Database)
- Prise en charge multilingue

# 🚀 Installation

Auto-hébergez l'addon (voir ci-dessous), puis ouvrez sa page `/configure` pour l'installer dans Stremio.

Vous aurez besoin de clés d'API pour les sources que vous souhaitez utiliser. Par exemple, si vous ne souhaitez que les recommandations TMDB, seule une clé d'API TMDB est requise.
Les liens pour obtenir des clés d'API gratuites sont disponibles directement sur la page de configuration de l'addon.

## Docker

Vous pouvez utiliser une image préconstruite depuis Docker Hub :

```bash
docker pull wallacecleaver/w-suggest
```

Ou cloner ce dépôt :

```bash
git clone https://github.com/Wallacecleaver/W-Suggest.git
```

### Docker CLI

1. Construire l'image Docker

```bash
docker build -t w-suggest .
```

2. Lancer le conteneur Docker

```bash
docker run -p 8080:3000 w-suggest
```

Vous pouvez personnaliser l'addon via un fichier `.env`. Voir ci-dessous pour les variables d'environnement.

```bash
docker run -p 8080:3000 --env-file .env w-suggest
```

3. Accédez à la page de configuration de l'addon sur `localhost:8080`.

### Docker Compose

1. Lancez la commande suivante :

```bash
docker compose up -d
```

2. Vous pouvez ajuster l'addon via un fichier `.env`. Voir ci-dessous pour les variables d'environnement.

## Lancement en local depuis les sources

1. Clonez le dépôt du projet et placez-vous dans le répertoire :

```bash
git clone https://github.com/Wallacecleaver/W-Suggest.git
```

```bash
cd W-Suggest
```

2. Créez votre fichier de configuration local en copiant le fichier d'exemple :

```bash
cp .env.example .env
```

3. Ouvrez `.env` et configurez les variables souhaitées (voir tableau ci-dessous).

4. Installez les dépendances du projet :

```bash
npm install
```

5. Lancez le projet :

```bash
npm start
```

6. Accédez à la page de configuration de l'addon sur `localhost:PORT`.

## Variables d'Environnement

| Variable           | Description                                        | Valeur par défaut       |
| ------------------ | -------------------------------------------------- | ----------------------- |
| DASHBOARD_PASSWORD | Mot de passe requis pour accéder à `/dashboard`     | *(Désactivé si vide)*   |
| SQLITE_PATH        | Chemin du fichier de base de données SQL pour le cache | `./data/cache.sqlite` |
| ENABLE_LOGGING     | Active les journaux de développement dans `logs/`  | `false`                 |
| PORT               | Port d'écoute du serveur de l'addon                | `8080`                  |
| CACHE_TTL          | Durée de vie du cache en secondes                  | `259200` (3 jours)      |
| CACHE_MAX_SIZE     | Taille maximale du cache (nombre d'entrées)        | `3000`                  |
| GEMINI_MAX_RESULT  | Nombre maximum de résultats Gemini IA par catalogue| `20`                    |
| REDIS_URL          | *(Optionnel)* URL Redis si vous préférez Redis      | *(Désactivé, SQLite actif)* |

## 📊 Tableau de bord d'administration (Dashboard)

Accédez au tableau de bord d'administration intégré à l'adresse : `http://localhost:PORT/dashboard`.

Fonctionnalités incluses :
- **Authentification sécurisée** : Protégé par `DASHBOARD_PASSWORD` défini dans le `.env`.
- **Métriques système & trafic** : Uptime, consommation mémoire, décompte des requêtes, latence et temps de réponse.
- **Gestion du Cache** : Taux de succès (hit ratio), statistiques de la base SQL SQLite et purge du cache en un clic.
- **Visualiseur de Logs** : Consultation en temps réel et purge des fichiers `app.log`, `error.log`, `cache.log`, et `emptyCatalog.log`.
- **Surveillance des Fournisseurs** : État opérationnel en direct des services externes (Cinemeta, TMDB, Trakt, Simkl, Gemini, TasteDive, RPDB).
- **Testeur interactif de clés API** : Validez vos clés API directement depuis le tableau de bord.

# Configuration

- **Inclure les collections TMDB dans les recommandations** :  
  TMDB regroupe les films associés (suites, sagas) en « collections ». Ces films ne sont pas systématiquement inclus dans les recommandations par défaut de TMDB.  
  Activez cette option pour ajouter les films d'une même collection au début de la liste des recommandations TMDB.  
  *Astuce : Pratique si vous voulez voir toutes les suites directes, mais peut encombrer le catalogue pour les sagas comprenant beaucoup de films.*

- **Combiner en un seul catalogue** :  
  Par défaut, chaque source de recommandation apparaît comme un catalogue distinct.  
  Activez cette option pour fusionner toutes les recommandations au sein d'un seul catalogue. Les titres les plus fréquemment recommandés apparaîtront en premier.  
  *(Remarque : Les catalogues combinés peuvent être un peu plus lents à charger).*

- **Ordre des catalogues** :  
  Glissez-déposez pour réorganiser l'ordre d'affichage des catalogues.

- **Activer la recherche manuelle par titre** :  
  Activez cette option pour chercher des recommandations par le titre du film/série en plus des identifiants IMDb.  
  *(Remarque : La recherche par titre est moins précise que l'utilisation d'identifiants exacts).*

- **Source de métadonnées** :  
  Par défaut, l'addon utilise Cinemeta (l'addon officiel de Stremio) pour les métadonnées des films et séries.  
  Activez ce réglage pour utiliser TMDB comme source de métadonnées à la place (nécessite une clé d'API TMDB).  
  *Astuce : TMDB est généralement plus fiable et complet que Cinemeta.*

- **Langue** :  
  Sélectionnez la langue utilisée pour les affiches, métadonnées et requêtes. Disponible uniquement lorsque TMDB est utilisé comme source de métadonnées.

- **Conserver les affiches en anglais** :  
  Permet de conserver les posters originaux en anglais même lorsque les métadonnées sont configurées dans une autre langue.

- **Boutons de flux (Stream Buttons)** :  
  Glissez-déposez pour réorganiser les boutons de flux ou masquer ceux que vous ne souhaitez pas afficher.

  Boutons disponibles :
  - *Voir les détails* – Ouvre la fiche détaillée de l'élément dans Stremio.
  - *Rechercher sur l'App* – Lance la recherche de recommandations directement dans l'application Stremio.
  - *Rechercher sur le Web* – Lance la recherche sur Stremio Web.
  - *Afficher des films/séries similaires* – Génère et affiche les recommandations sous forme de flux dans Stremio.

# Utilisation

Pour n'importe quel film ou série télévisée, utilisez les boutons de flux fournis par l'addon pour accéder rapidement aux recommandations.

## Obtenir des recommandations via la barre de recherche

Cliquez sur le bouton **Rechercher sur l'App** ou **Rechercher sur le Web** pour rechercher automatiquement dans Stremio en utilisant l'identifiant de l'élément.  
Vous pouvez également saisir un identifiant manuellement dans la barre de recherche de Stremio.

Si la recherche par titre est activée, vous pouvez aussi saisir un titre. Pour de meilleurs résultats, saisissez le titre exact et ajoutez :

- `y:` suivi de l'année de sortie
- `t:` suivi du type (`movie` pour film ou `series` pour série)

Exemples :
- `Inception y:2010 t:movie`
- `Breaking Bad y:2008 t:series`

Vous pouvez aussi utiliser des identifiants issus d'autres plateformes :
- `tmdb:1726`
- `kitsu:12`

## Obtenir des recommandations sous forme de flux

Cliquez sur le bouton de flux **Afficher les recommandations** pour faire apparaître les recommandations directement sous forme de flux sur la page en cours dans Stremio.  
Un catalogue combiné de toutes les sources activées sera affiché.

Limitations :
- L'interface de Stremio affiche toujours les informations du film ou de la série d'origine et ne s'adapte pas pour chaque recommandation. En solution de contournement, le détail des recommandations est ajouté dans la section Résumé (*Summary*).
- Pour les séries TV, vous ne pouvez pas sélectionner directement un épisode depuis la liste des recommandations. L'addon fournit un bouton de flux optionnel qui vous redirige vers la page détaillée de la série.
- Cette méthode est généralement plus lente car les métadonnées doivent être générées pour chaque recommandation. Les performances diminuent au fur et à mesure que vous activez plus de sources.

## Astuces

Voici quelques conseils pour obtenir les meilleurs résultats :

- Utilisez le gestionnaire d'addons de Stremio pour placer cet addon tout en haut de votre liste. Cela garantit que son catalogue et ses boutons s'affichent en premier.  
  *Remarque : Stremio recommande de garder Cinemeta en haut, ajustez donc avec précaution.*
- Lors d'une recherche manuelle par titre, soyez précis en renseignant à la fois l'année et le type comme indiqué ci-dessus.

## Problèmes connus & Limitations

Cet addon est un projet en cours d'amélioration. Bien qu'il fonctionne très bien dans la majorité des situations, quelques limitations subsistent :

- Les boutons de flux ne sont pas compatibles avec les Smart TVs ou Stremio 5 Beta. La recherche manuelle permet toutefois de faire remonter les catalogues de recommandations.
- Les métadonnées TMDB peuvent ne pas s'afficher correctement sur la version Android stable actuelle, mais fonctionnent avec la nouvelle version bêta sur Android.
- Les sorties très récentes, les titres non sortis ou le contenu international obscur peuvent parfois donner des résultats étranges ou vides.
- Fonctionne de manière optimale avec les catalogues par défaut de Stremio. Non compatible avec d'autres addons générant des catalogues et identifiants personnalisés.

# 🔓 Sécurité

- Chiffrement des données utilisateur : AES-256 GCM + PBKDF2
- Clés API : Les clés API ne sont jamais stockées sur le serveur

## 🙏 Remerciements & Crédits

W Suggest est un fork de [More Like This](https://github.com/rama1997/More-Like-This) créé par [rama1997](https://github.com/rama1997), publié sous licence MIT.
