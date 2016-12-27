import Cache                  from '../services/cache';
import Config                 from '../services/config';
import Container              from '../services/container';
import JiraClient             from '../../domain/backend/jira/client';
import JiraMetadata           from '../../domain/backend/jira/metadata';
import JiraRepository         from '../../domain/backend/jira/repository';
import * as issueExpectations from '../../domain/backend/jira/requirements/issue';
import configExpectations     from '../../domain/backend/jira/requirements/config';
import JiraNormalizer         from '../../domain/backend/jira/normalizer';
import IssueTracker           from '../../domain/model/tracker';

export default function buildJira(container: Container, config: Object): Container {
  container.registerService(
    'tracker.jira.client',
    (config, logger) => new JiraClient(logger, config),
    ['config', 'logger']
  );

  container.registerService(
    'tracker.jira.metadata',
    (client: JiraClient, cache: Cache) => new JiraMetadata(client, cache),
    ['tracker.jira.client', 'cache']
  );

  container.registerService(
    'tracker.jira.normalizer',
    (metadata: JiraMetadata, config: Config) => new JiraNormalizer(metadata, config, issueExpectations),
    ['tracker.jira.metadata', 'config']
  );

  container.registerService(
    'tracker.jira.repository',
    (client, cache, normalizer, metadata, logger) => new JiraRepository(client, cache, normalizer, metadata, logger),
    ['tracker.jira.client', 'cache', 'tracker.jira.normalizer', 'tracker.jira.metadata', 'logger'],
  );

  container.registerService(
    'tracker.jira',
    (normalizer, repository, metadata) => new IssueTracker(normalizer, repository, metadata, configExpectations),
    ['tracker.jira.normalizer', 'tracker.jira.repository', 'tracker.jira.metadata']
  );

  container.registerService('tracker', tracker => tracker, ['tracker.jira']);
  return container;
}
