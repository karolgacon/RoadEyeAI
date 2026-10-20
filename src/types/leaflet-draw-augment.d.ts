import "leaflet";

declare module "leaflet" {
  namespace DrawEvents {
    interface Created {
      layer: Layer;
      layerType: string;
    }
  }

  namespace Draw {
    namespace Event {
      const CREATED: string;
      const DELETED: string;
    }
  }

  namespace Control {
    class Draw extends Control {
      constructor(options?: Control.DrawConstructorOptions);
    }
  }
}
