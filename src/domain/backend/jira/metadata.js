'use strict';

var _               = require('underscore');
var util            = require('util');
var Promise         = require('bluebird');
var Expectations    = require('../../model/expectations');
var TrackerMetadata = require('../../model/trackerMetadata');
var Label           = require('../../model/meta/label');
var User            = require('../../model/meta/user');
var Sprint          = require('../../model/meta/sprint');
var Type            = require('../../model/meta/type');
var Status          = require('../../model/meta/status');
var Project         = require('../../model/meta/project');

/**
 * Metadata for JIRA
 * All metadata is lazy-loaded, cached, and returned as Promises
 *
 * @param {JiraClient} client
 * @param {Storage} storage
 */
function JiraMetadata(client, cache, projectKey) {
  var metadata = this;
  var ttl = 86400;

  TrackerMetadata.call(this);

  /**
   * Fetches the available types in Jira
   *
   * @param {Boolean} invalidate
   * @return {Promise<Array><Type>}
   */
  this.getTypes = function(invalidate) {
    var cached = cache.get('types', invalidate);
    if (cached) return Promise.resolve(cached.map(Type.unserialize));

    return client.get('/rest/api/2/issue/createmeta')
      .then(function(response) {
        return response.projects.map(function(project) {
          return project.issuetypes.map(function(type) {
            return new Type(type.id, type.name);
          });
        });
      })
      .reduce(function(types, typesByProject) {
        return _.uniq(types.concat(typesByProject), false, String);
      }, [])
      .then(cache.setSerializedThenable('types', ttl));
  };

  /**
   * Fetches the available users in Jira
   * Iterates through all projects and builds up a unique list
   *
   * @param {Boolean} invalidate
   * @return {Promise<Array><User>}
   */
  this.getUsers = function(invalidate) {
    var cached = cache.get('users', invalidate);
    if (cached) return Promise.resolve(cached.map(User.unserialize));

    return metadata.getProjects()
      .map(function(project) {
        var opts = { qs: { project: project.getId()} };
        return client.get('/rest/api/2/user/assignable/search', opts)
          .then(function(response) {
            return response.map(function(user) {
              return new User(user.name);
            });
          });
      })
      .reduce(function(users, usersInProject) {
        return _.uniq(users.concat(usersInProject), false, function(user) {
          return user.getAccount();
        });
      }, [])
      .filter(function(user) {
        return user.getAccount().indexOf('addon_') !== 0;
      })
      .then(cache.setSerializedThenable('users', ttl));
  };

  /**
   * Fetches views
   *
   * @param {Boolean} invalidate
   * @return {Promise<Array><Object>}
   */
  this.getViews = function(invalidate) {
    var cached = cache.get('views', invalidate);
    if (cached) return Promise.resolve(cached);

    return client.get('/rest/greenhopper/1.0/rapidview')
      .then(function(response) { return response.views; })
      .then(cache.setThenable('views', ttl));
  };

  /**
   * Fetches the available sprints in Jira
   *
   * @param {Boolean} invalidate
   * @return {Promise<Array><Sprint>}
   */
  this.getSprints = function(invalidate) {
    var cached = cache.get('sprints', invalidate);
    if (cached) return Promise.resolve(cached.map(Sprint.unserialize));

    return metadata.getViews()
      .map(function(view) {
        var opts = { qs: { rapidViewId: view.id } };
        return client.get('/rest/greenhopper/1.0/xboard/plan/backlog/data.json', opts)
          .then(function(response) {
            return response.sprints.map(function(sprint) {
              return new Sprint(sprint.id, sprint.name);
            });
          });
      })
      .reduce(function(allSprints, sprintsPerView) {
        return allSprints.concat(sprintsPerView);
      }, [])
      .then(cache.setSerializedThenable('sprints', ttl));
  };

  /**
   * Fetches the available labels in Jira
   *
   * @param {Boolean} invalidate
   * @return {Promise<Array><Label>}
   */
  this.getLabels = function(invalidate) {
    var cached = cache.get('labels', invalidate);
    if (cached) return Promise.resolve(cached.map(Label.unserialize));

    return client.get('/rest/api/1.0/labels/suggest?query=')
      .then(function(body) {
        return body.suggestions.map(function(label) {
          return new Label(null, label.label);
        });
      })
      .then(cache.setSerializedThenable('labels', ttl));
  };

  /**
   * Fetches available projects from JIRA
   *
   * @param {Boolean} invalidate
   * @return {Promise<Array><Project>}
   */
  this.getProjects = function(invalidate) {
    var cached = cache.get('projects', invalidate);
    if (cached) return Promise.resolve(cached.map(Label.unserialize));

    return client.get('/rest/api/2/issue/createmeta')
      .then(function(response) {
        return response.projects.map(function(project) {
          return new Project(project.key, project.name, project.id);
        });
      });
  };

  /**
   * Fetches the available statuses in Jira (scoped to configured project)
   *
   * @param {Boolean} invalidate
   * @return {Promise<Array><Status>}
   */
  this.getStatuses = function(invalidate) {
    var cached = cache.get('statuses', invalidate);
    if (cached) return Promise.resolve(cached.map(Status.unserialize));

    return metadata.getProjects()
      .map(function(project) {
        return client.get('/rest/api/2/project/' + project.getInternalId() + '/statuses')
          .reduce(function(statuses, type) {
            return _.uniq(statuses.concat(type.statuses), _.property('name'));
          }, []);
      })
      .reduce(function(statuses, statusesPerProject) {
        return _.uniq(statuses.concat(statusesPerProject), _.property('name'));
      }, [])
      .map(function(status) {
        return new Status(status.name);
      })
      .then(cache.setSerializedThenable('statuses', ttl));
  };

  /**
   * Finds all transitions for a ticket
   *
   * @param {String} num - issue number
   * @param {Boolean} invalidate
   * @return {Promise<Array><Object>}
   */
  this.getTransitions = function(num, invalidate) {
    var cached = cache.get('transitions:' + num, invalidate);
    if (cached) return Promise.resolve(cached);

    var opts = { qs: { expand: 'transitions.fields' } };
    return client.get('/rest/api/2/issue/' + num + '/transitions', opts)
      .then(function(response) { return response.transitions; })
      .then(cache.setThenable('transitions:' + num, ttl));
  };

  /**
   * Gets the transition for a given issue/status
   *
   * @param {String} num - issue number
   * @param {String} status - new status
   * @return {Promise<Object>} transition
   * @throws {Error} when a suitable transition could not be found
   */
  this.getIssueTransition = function(num, status) {
    return metadata.getTransitions(num).then(function(transitions) {
      var transition = _.find(transitions, function(transition) {
        return status.toLowerCase() === transition.to.name.toLowerCase();
      });

      if (!transition) throw new Error('Could not find transition for ' + status);
      return transition;
    });
  };

  /**
   * Converts a transition into an expectations
   *
   * @param {Object} transition
   * @return {Expectations}
   */
  this.transitionToExpectations = function(transition) {
    return new Expectations(
      _.chain(transition.fields)
        .keys()
        .map(function(field) {
          return {
            field: field,
            type: 'string',
            required: transition.fields[field].required,
            default: null,
            choices: Promise.resolve(transition.fields[field].allowedValues)
          };
        })
        .filter(_.property('required'))
        .map(function(field) {
          field.choices = field.choices.map(function(f) { return f.name; });
          return field;
        })
        .indexBy('field')
        .value()
    );
  };

}

util.inherits(JiraMetadata, TrackerMetadata);

module.exports = JiraMetadata;
