import React, { useEffect } from 'react';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function SlidesPage() {
  const slidesUrl = useBaseUrl('/slides/');

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <Layout
      title="Overview Slides"
      description="GrillMyCode overview presentation"
      noFooter
    >
      <iframe
        src={slidesUrl}
        title="GrillMyCode Overview Slides"
        style={{
          position: 'fixed',
          top: 'var(--ifm-navbar-height, 60px)',
          left: 0,
          width: '100%',
          height: 'calc(100vh - var(--ifm-navbar-height, 60px))',
          border: 'none',
        }}
        allowFullScreen
      />
    </Layout>
  );
}
