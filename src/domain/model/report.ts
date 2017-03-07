import { EventEmitter}     from 'events';
import FilterSet           from './filterSet';
import { SerializedFilter} from './filter';

export interface SerializedReport {
  name: string,
  filters: SerializedFilter[]
}

export default class Report extends EventEmitter {
  public readonly name: string;
  public filters: FilterSet;

  constructor(name: string, filters: FilterSet) {
    super();
    this.name = name;
    this.filters = filters.clone();
    this.filters.on('change', () => this.emit('change'));
  }

  public replaceFilters(filters: FilterSet) {
    this.filters = filters.clone();
    this.emit('change');
  }

  public serialize(): SerializedReport {
    return {
      name: this.name,
      filters: this.filters.serialize()
    };
  }

  public static unserialize(data: SerializedReport): Report {
    return new Report(data.name, FilterSet.unserialize(data.filters));
  }

}
