declare const __SOUND_MANAGER_BUILD_ID__: string | undefined;

/**
 * 오디오 훅 및 콘텐츠 브리지의 빌드 고유 식별자(buildId)를 해석한다.
 * - 번들링 시 scripts/build.mjs가 코드 해시 기반 문자열을 주입한다.
 * - 단위 테스트나 독립 실행 환경에서는 override 또는 "dev-unbundled" 폴백을 반환한다.
 */
export function resolveBuildId(override?: string): string {
  if (typeof override === "string" && override.trim().length > 0) {
    return override.trim();
  }
  if (typeof __SOUND_MANAGER_BUILD_ID__ === "string" && __SOUND_MANAGER_BUILD_ID__.length > 0) {
    return __SOUND_MANAGER_BUILD_ID__;
  }
  return "dev-unbundled";
}
