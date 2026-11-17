import React from 'react';
import { Button } from './Button';

interface State { hasError: boolean }

export class RouteErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error) {
    // Log only a generic marker; do not risk exposing rendered user data.
    console.error('Admin page rendering failed.');
  }

  render() {
    if (this.state.hasError) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6"><div className="bg-white p-8 rounded-xl border border-slate-200 text-center max-w-md"><h1 className="text-base font-semibold text-slate-900">Halaman mengalami kendala</h1><p className="text-xs text-slate-500 mt-2">Muat ulang halaman untuk mencoba kembali.</p><Button className="mt-4" onClick={() => window.location.reload()}>Muat Ulang</Button></div></div>;
    }
    return this.props.children;
  }
}
