import { MODEL_ROUTING_YAML, PRICING_CONFIG_YAML } from '../presets/referenceConfigs';

/**
 * Config presets the DSL resolves by name (Phase 1).
 *
 * A `configs:` entry whose value is the literal `preset` resolves here; any
 * other string value is used verbatim as inline config text.
 *
 * `model_routing` and `pricing_config` come from the studio's generated
 * reference configs. `sources_watchlist` is the INFLUENCER-system watchlist
 * (Instagram only) — it differs from the generic SOURCES_WATCHLIST_YAML in
 * referenceConfigs.ts (Y Combinator / EU Horizon / Google / AWS / Microsoft
 * sources). It lives here, not there: that file's header forbids hand edits
 * ("GENERATED VERBATIM … Do not hand-edit"). The text below is byte-identical
 * to the INFLUENCER_WATCHLIST_YAML constant in tests/influencers-v3-build.test.ts
 * (and its v1/v2 copies); the v3 hash test guards it — any drift breaks the hash.
 */
export const INFLUENCER_WATCHLIST_YAML = `# config/sources_watchlist.yaml — influencer system (Instagram only)
# Approved source is Instagram only at this stage (founder decision, 25 Oct 2026).
# The database's 15-group source registry is a separate register; it does not widen this allowlist.
blocked_ip_ranges:
  - "10.0.0.0/8"         # RFC 1918 — private networks
  - "172.16.0.0/12"      # RFC 1918
  - "192.168.0.0/16"     # RFC 1918
  - "127.0.0.0/8"        # Loopback
  - "169.254.169.254/32" # AWS/GCP IMDS
  - "fd00::/8"           # IPv6 ULA

approved_sources:
  instagram:
    name:   "Instagram"
    domain: "instagram.com"
    paths:  ["/"]

constraints:
  max_timeout:         10
  max_response_size:   5242880
  methods:             [GET, HEAD]
`;

/** The three config slots of a v2 ProjectFile, in file order. */
export const CONFIG_KEYS = ['model_routing', 'sources_watchlist', 'pricing_config'] as const;
export type ConfigKey = (typeof CONFIG_KEYS)[number];

export const CONFIG_PRESETS: Record<ConfigKey, string> = {
  model_routing: MODEL_ROUTING_YAML,
  sources_watchlist: INFLUENCER_WATCHLIST_YAML,
  pricing_config: PRICING_CONFIG_YAML,
};
