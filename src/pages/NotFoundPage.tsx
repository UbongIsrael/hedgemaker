import {Link} from 'react-router-dom';
import {Button} from '@/components/ui';

export function NotFoundPage() {
  return (
    <div className="page-shell not-found">
      <span>404</span>
      <h1>We couldn’t find this page.</h1>
      <p>The link may be incorrect or the page may no longer be available.</p>
      <Link to="/"><Button>Return home</Button></Link>
    </div>
  );
}
