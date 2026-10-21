/** Searchable document categories on a person's homepage. */
export type ProfileSearchScope = 'expressions' | 'agreements' | 'actions' | 'graphs'

/** Keyword and optional bidirectional agreement counterpart for one profile search. */
export type ProfileSearchCriteria = { keyword: string; counterpartId: string }
