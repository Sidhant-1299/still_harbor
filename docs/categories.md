# Bundled starter categories

List version: **2026-10-11**. Source: `src/categories.ts`.

These are manually selected, reviewable domain lists—not a comprehensive content-classification service, a statement of illegality, or a judgement of the people using the services. Domain names are factual identifiers. No upstream blocklist is imported wholesale, and there is no runtime blocklist download or automatic site probing.

- **Social media:** major social feeds, messaging, and video communities. Includes services with legitimate work/educational uses. Includes a few short-link domains, but not every asset CDN or every federated server.
- **Pornography:** major adult video, webcam, and creator/subscription platforms. Includes mixed-purpose platforms such as OnlyFans; does not block sexual-health or sex-education sites as a category.
- **Betting & gambling:** sportsbooks, casinos, poker, sweepstakes casinos, and real-money fantasy sports. Blocking a broad domain such as `caesars.com` also affects hotel/travel pages. This is intentional and disclosed in the domain preview; these sites are not necessarily illegal in your jurisdiction.

All domains include their subdomains, but not fuzzy names. Each category is one boundary backed by a native Chrome rule containing the listed domains. Adding a group preserves existing individual boundaries. Individual domain/URL/keyword boundaries take priority over category destinations. A URL boundary is not an exception to a category's coverage: a selected category still blocks other paths on the same site. Categories can be paused, removed, or assigned a redirect; weakening a category requires the optional password, just like an individual rule.

## Reference material

Used to identify service types and common domains, not as a copied list or a claim of live availability:

- [Wikipedia: List of social networking services](https://en.wikipedia.org/wiki/List_of_social_networking_services)
- [Wikipedia: xHamster](https://en.wikipedia.org/wiki/XHamster) and [XVideos](https://en.wikipedia.org/wiki/XVideos), including related distribution-platform references
- [Wikipedia: Bet365](https://en.wikipedia.org/wiki/Bet365) and [Betfair](https://en.wikipedia.org/wiki/Betfair)
- [Cyprus National Betting Authority's published blocking list](https://nba.gov.cy/wp-content/uploads/BlockingListLatest.txt), illustrating gambling operators and regional/mirror-domain churn. Classification here is not based on Cyprus licensing status.

No live visits to adult or gambling sites are needed to install or enable a category. New sites, aliases, country-specific domains, proxies, and mirrors can escape these starter lists. Add individual boundaries for missing domains. Review lists in the UI before enabling a category. Future shipped-list changes can alter category coverage, so review release notes before updating.
