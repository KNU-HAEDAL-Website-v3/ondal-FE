import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/** 브라우저용 mock 서버. VITE_API_MOCK=true 일 때만 main.tsx가 동적 import 한다 (일반 빌드엔 안 실림). */
export const worker = setupWorker(...handlers)
