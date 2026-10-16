/**
 * Firebase 설정 (프로젝트 contract-d6cf3). Firebase 콘솔 → 프로젝트 설정 → 일반 → 내 앱(웹)의 apiKey와 projectId를 넣으면
 * 온라인 계정(어느 기기에서든 같은 아이디로 로그인)으로 동작한다.
 * 비워 두면 같은 로그인 화면이 "이 기기 전용 계정"(브라우저 저장소)으로 동작한다.
 *
 * Firebase 쪽 준비 (README의 "계정과 저장" 참고):
 *  1. Authentication → 로그인 방법 → 이메일/비밀번호 사용 설정
 *  2. Firestore Database 만들기
 *  3. Firestore 규칙:
 *     rules_version = '2';
 *     service cloud.firestore {
 *       match /databases/{database}/documents {
 *         match /saves/{uid} {
 *           allow read, write: if request.auth != null && request.auth.uid == uid;
 *         }
 *       }
 *     }
 *  apiKey는 웹앱에 원래 공개되는 값이다(보안은 위 규칙이 담당).
 */
export const FIREBASE = {
  apiKey: 'AIzaSyANYHUCo7ZNBDt5VZxE_3AAk5KhoFBS_7U',
  projectId: 'contract-d6cf3',
};

/** 개발·자동 테스트용: localStorage 'pact_force_local' = '1'이면 Firebase 대신 기기 전용 계정 */
function forceLocal(): boolean {
  try {
    return globalThis.localStorage?.getItem('pact_force_local') === '1';
  } catch {
    return false;
  }
}

export const firebaseEnabled = (): boolean => !!FIREBASE.apiKey && !!FIREBASE.projectId && !forceLocal();
