// lib/favorites.ts
//
// Favorite orgs are stored on the user's profile server-side, not in
// localStorage — they need to follow the user across devices/sessions.
//
// BACKEND STATUS: the GraphQL mutation/query below are written against the
// shape we want, but do not exist on the server yet. ResolveFavoriteOrgs /
// the mutation will 404 or error until the backend lands. Swap the
// implementation of fetchFavoriteOrgs / setFavoriteOrgOnServer once the
// resolvers exist — call sites elsewhere in the app do not need to change.
//
// Expected schema (to be added server-side):
//
//   type User {
//     ...
//     favorite_orgs: [String!]!
//   }
//
//   extend type Query {
//     myFavoriteOrgs: [String!]!
//   }
//
//   extend type Mutation {
//     toggleFavoriteOrg(orgName: String!): [String!]!  # returns the updated list
//   }

import { graphqlQuery } from './graphql'

export const GET_MY_FAVORITE_ORGS = `
  query GetMyFavoriteOrgs {
    myFavoriteOrgs
  }
`

export const TOGGLE_FAVORITE_ORG = `
  mutation ToggleFavoriteOrg($orgName: String!) {
    toggleFavoriteOrg(orgName: $orgName)
  }
`

interface GetMyFavoriteOrgsResponse {
  myFavoriteOrgs: string[]
}

interface ToggleFavoriteOrgResponse {
  toggleFavoriteOrg: string[]
}

/**
 * Fetch the current user's favorite orgs from the backend.
 * Returns an empty list (and logs) if the user is unauthenticated or the
 * backend call fails — callers should already be gating this behind a
 * logged-in check, so a failure here should not crash the page.
 */
export async function fetchFavoriteOrgs(): Promise<string[]> {
  try {
    const response = await graphqlQuery<GetMyFavoriteOrgsResponse>(GET_MY_FAVORITE_ORGS)
    return Array.isArray(response.myFavoriteOrgs) ? response.myFavoriteOrgs : []
  } catch (error) {
    console.error('Failed to fetch favorite orgs:', error)
    return []
  }
}

/**
 * Toggle a single org's favorite status on the server and return the
 * updated full list. Throws on failure so the caller can roll back any
 * optimistic UI update.
 */
export async function toggleFavoriteOrgOnServer(orgName: string): Promise<string[]> {
  const response = await graphqlQuery<ToggleFavoriteOrgResponse>(TOGGLE_FAVORITE_ORG, { orgName })
  return Array.isArray(response.toggleFavoriteOrg) ? response.toggleFavoriteOrg : []
}