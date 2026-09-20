import { useParams } from 'react-router-dom'
import { PublicProfileScreen } from '@/widgets/account/ui/PublicProfileScreen'

export function PublicProfilePage() {
  const { handle = '' } = useParams()
  return <PublicProfileScreen userId={handle} />
}
