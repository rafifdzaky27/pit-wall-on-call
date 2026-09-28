import { lazy, type ComponentType } from "react";

type Module<P> = { default: ComponentType<P> };

/**
 * `React.lazy` that renders without suspending once its chunk has loaded: after the first load, the
 * loader hands React a plain thenable that calls back synchronously. `load()` warms it up (tests call
 * it before rendering, so fake timers never wait on a cold import).
 */
export function preloadable<P = object>(factory: () => Promise<Module<P>>) {
  let loaded: Module<P> | null = null;
  const load = (): PromiseLike<Module<P>> => {
    if (loaded) {
      const mod = loaded;
      return { then: (onLoaded) => Promise.resolve(onLoaded ? onLoaded(mod) : mod) as never };
    }
    return factory().then((m) => (loaded = m));
  };
  // React only calls `then`; the loaded case is deliberately not a real Promise.
  return { load, Component: lazy(load as () => Promise<Module<P>>) };
}
