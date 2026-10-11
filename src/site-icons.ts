import { domainMatches } from './core';

// Facebook's own 32px favicon, converted from its ICO container to PNG.
// Bundled so the actual mark appears offline, without opt-in networking.
// Retrieved from https://facebook.com/favicon.ico on 2026-10-11.
// The Facebook mark belongs to Meta; inclusion does not imply endorsement.
const FACEBOOK_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAB1UlEQVR4nL1XsU7DMBDNgpJuHRm7sbLxBfAHzM2AnY5dmctYiUiIuf2GsrLwBSkbE63owFAkT8wPndOUkDr47BhOelIFrd/z+Z19F0XM6I/RTwTSJMOsJ1HEAiqRAIE+09/of4nEkL7LXdcayQiDXoa8TsgCiRlh4E1Mu4glbp1IDaA1vHadSKy6ktewYmfjSOA0MPleBK39pzs/HpfwyoR2uSP5+RS4ewTWHziI5w1weW8W0U8NVeJquJuHQ9JmXM2YxtylPij5bwI06keRSMy55CfXPHKbgJ5AXrKn+uzZu6dF20J9Ass34OmlxMW0fZ1YQmkv6OvVQcCiMJOT6SwVcAiB1Cn9hOXGLOBs4lG6GWbk/sLlR+utWYAzeXkMReT6yJgE0D3gKUBFrj8KKYBgFeBSds3gmNJ6BL4COFnRR2Azoa8AugdYJrSVoa+AyYJZhraLiASQ8Sq0pnz7Ey0vYRNDfRW7lGLIKtg/y7FA/u8CKP0+z3EwAc3OiJuFEAK+n+J6pLyWLICAVevgwmlKOwqwt+e2tryDAHtbzsmEpwD+YFL3hMmYrgLIcJ2G1V025i4C9LScIe80nDajGs/fFeYAqDNUlYDXLVRcjecCqcuOvwAGXSme2wrXuwAAAABJRU5ErkJggg==';

export function bundledIcon(domain: string): string | null {
  return ['facebook.com', 'fb.com'].some(host => domainMatches(domain, host)) ? FACEBOOK_ICON : null;
}

export function browserIconUrl(domain: string, extensionBase: string): string {
  const url = new URL('_favicon/', extensionBase);
  url.searchParams.set('pageUrl', `https://${domain}/`);
  url.searchParams.set('size', '32');
  return url.href;
}
