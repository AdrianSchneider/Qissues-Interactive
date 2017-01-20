import * as Promise         from 'bluebird';
import * as blessed         from 'blessed'
import Behaviour            from '../behaviour';
import BlessedInterface     from '../interface';
import Sequencer            from '../services/sequencer';
import HasIssues            from '../views/hasIssues';
import { ChangeSetBuilder } from '../../domain/model/changeSet';
import TrackerMetadata      from '../../domain/model/trackerMetadata';
import Cancellation         from '../../domain/errors/cancellation';
import Filter               from '../../domain/model/filter';
import FilterSet            from '../../domain/model/filterSet';

interface FilterableOptions {
  keys: FilterableKeys,
  getFilters: () => FilterSet
}

interface FilterableKeys {
  filterList: string,
  filterAssignee: string,
  filterStatus: string,
  filterSprint: string,
  filterType: string,
}

/**
 * Responsible for creating changesets for the selected issues
 */
export default class Filterable implements Behaviour {
  private view: HasIssues;
  private readonly sequencer: Sequencer;
  private readonly metadata: TrackerMetadata;
  private readonly ui: BlessedInterface;
  private filters: FilterSet;

  public readonly name: string = 'filterable';
  public readonly events: string[] = [];

  constructor(ui: BlessedInterface, sequencer: Sequencer, metadata: TrackerMetadata) {
    this.ui = ui;
    this.sequencer = sequencer;
    this.metadata = metadata;
  }

  /**
   * Registers the yankable with the node
   */
  public attach(view: HasIssues, options: FilterableOptions): void {
    if (this.view) throw new Error('Filterable already has a view');
    this.filters = options.getFilters();

    this.view = view;
    this.sequencer
      .on(view.node, options.keys.filterList, this.listFilters())
      .on(view.node, options.keys.filterAssignee, this.filterFromSelection(
        (invalidate) => this.metadata.getUsers({ invalidate })
          .then(users => ['Unassigned'].concat(users.map(String))),
        'Assignee',
        'assignee'
      ))
      .on(view.node, options.keys.filterSprint, this.filterFromSelection(
        (invalidate) => this.metadata.getSprints({ invalidate })
          .then(sprints => ['Backlog'].concat(sprints.map(String))),
        'Sprint',
        'sprint'
      ))
      .on(view.node, options.keys.filterType, this.filterFromSelection(
        (invalidate) => this.metadata.getTypes({ invalidate })
          .then(types => types.map(String)),
        'Type',
        'type'
      ))
      .on(view.node, options.keys.filterStatus, this.filterFromSelection(
        (invalidate) => this.metadata.getStatuses({ invalidate })
          .then(users => users.map(String)),
        'Status',
        'status'
      ));
  }

  public serialize() {
    return {};
  }

  /**
   * Shows the manipulable list of filters
   */
  private listFilters() {
    return () => {
      const options = this.filters.map(filter => `${filter.type} = ${filter.value}`);
      return this.ui.selectFromList('Filters', options)
        .catch(Cancellation, () => {});
    };
  }

  /**
   * Resolves to the application of a filter chosen from a lazily
   * loaded list
   */
  private filterFromSelection(getOptions: (i) => Promise<string[]>, message: string, field: string) {
    return () => this.ui.selectFromCallableList(message, getOptions)
      .then(selection => this.filterBy(field, selection))
      .catch(Cancellation, () => {});
  }

  /**
   * Applies the filters
   */
  private filterBy(field: string, selection: string) {
    console.error(`Selected ${field} = ${selection}`);
    this.filters.add(new Filter(field, selection));
  }

}