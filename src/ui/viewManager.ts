import { Widgets }       from 'blessed';
import Behaviour         from './behaviour';
import BlessedInterface  from './interface';
import View              from './view';
import Application       from '../app/main';
import KeyMapping        from '../app/config/keys';
import Marker            from './marker';

/**
 * Responsible for instantiating views
 * and attaching them to their parent elements with
 * behaviours in place
 */
export default class ViewManager {

  private readonly app: Application;
  private readonly ui: BlessedInterface;
  private readonly keys: KeyMapping;
  private readonly views: ViewMap;

  constructor(app: Application, ui, keys) {
    this.app = app;
    this.ui = ui;
    this.ui.viewManager = this;
    this.keys = keys;
    this.views = {};
  }

  /*
   * Registers a new view for later instantiation
   */
  public registerView(name: string, view: Function, behaviours: (() => Behaviour)[]) {
    if (typeof this.views[name] !== 'undefined') {
      throw new Error(`Cannot redefine view ${name}`);
    }

    this.views[name] = { view , behaviours };
  }

  /**
   * Gets a view attached to the parent element
   * This attaches the behaviours to the view and the marker re-rendering
   */
  public getView(name: string, element: Widgets.BlessedElement, options: Object = {}): View {
    if (typeof this.views[name] === 'undefined') {
      throw new Error(`View ${name} is not registered yet`);
    }

    const markers = [];
    const viewConfig = this.views[name];
    const view = this.construct(viewConfig.view, element, options);

    viewConfig.behaviours.forEach(getBehaviour => {
      const behaviour = getBehaviour();
      behaviour.attach(view, {
        keys: this.keys,
        getFilters: () => this.app.getFilters()
      })

      view.onAddBehaviour(behaviour);
      if (behaviour.marker) markers.push(behaviour.marker);
    });

    const marker = new Marker(markers);
    marker.setupRendering(view);

    return view;
  }

  private construct(ctor, ...args): View {
    return new ctor(this.app, this.ui, this.keys, ...args);
  }

}

interface ViewMap {
  [key: string]: ViewConfig
}

interface ViewConfig {
  view: Function,
  behaviours: (() => Behaviour)[]
}
