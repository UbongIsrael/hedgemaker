import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';

/** Restore a useful starting point on routes and make cross-page section links work. */
export function PageNavigation() {
  const {pathname, hash} = useLocation();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (hash) {
        document.getElementById(hash.slice(1))?.scrollIntoView();
      } else {
        window.scrollTo({top: 0, behavior: 'instant'});
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);
  return null;
}
