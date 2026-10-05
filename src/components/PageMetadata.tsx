import {useEffect} from 'react';

export function PageMetadata({title, description}: {title: string; description: string}) {
  useEffect(() => {
    const previousTitle = document.title;
    const existing = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const meta = existing ?? document.createElement('meta');
    const previousDescription = meta.content;
    meta.name = 'description';
    meta.content = description;
    if (!existing) document.head.appendChild(meta);
    document.title = title;
    return () => {
      document.title = previousTitle;
      if (existing) meta.content = previousDescription;
      else meta.remove();
    };
  }, [title, description]);
  return null;
}
