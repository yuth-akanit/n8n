import { LoginForm } from './LoginClient'

// Force dynamic — prevents prerender attempt during build without env vars
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return <LoginForm />
}
