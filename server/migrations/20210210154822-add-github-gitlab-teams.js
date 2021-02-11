'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('teams', 'gitlabId', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });
    await queryInterface.addColumn('teams', 'githubId', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });
    await queryInterface.addIndex('teams', ['gitlabId']);
    await queryInterface.addIndex('teams', ['githubId']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('teams', 'gitlabId');
    await queryInterface.removeColumn('teams', 'githubId');
    await queryInterface.removeIndex('teams', ['gitlabId']);
    await queryInterface.removeIndex('teams', ['githubId']);
  }
};