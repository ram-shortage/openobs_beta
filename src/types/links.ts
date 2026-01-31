/**
 * Link-related type definitions
 */

/**
 * Information about a link between notes
 */
export interface LinkInfo {
  /** Path to the linked note */
  path: string;
  /** Title of the linked note */
  title: string;
  /** Optional display text for the link */
  link_text: string | null;
}

/**
 * Response from backlinks/outgoing links commands
 */
export interface LinksResponse {
  /** Path of the note being queried */
  path: string;
  /** List of links */
  links: LinkInfo[];
}
