'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('teams', 'discordId', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });
    await queryInterface.addIndex('teams', ['discordId']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('teams', 'discordId');
    await queryInterface.removeIndex('teams', ['discordId']);
  }
};