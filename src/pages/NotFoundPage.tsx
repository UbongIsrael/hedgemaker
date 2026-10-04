import {Link} from 'react-router-dom';
import {Button} from '@/components/ui';

export function NotFoundPage() {
  return (
    <div className="page-shell not-found">
      <span>404</span>
      <h1>This market page does not exist.</h1>
      <p>The order may have moved, or the link may be incomplete.</p>
      <Link to="/"><Button>Return home</Button></Link>
    </div>
  );
}
