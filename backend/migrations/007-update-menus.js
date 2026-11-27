import { DataTypes } from 'sequelize';

export async function up({ context: queryInterface }) {
    const sequelize = queryInterface.sequelize;

    await sequelize.transaction(async transaction => {
        const options = { transaction };

        await queryInterface.changeColumn('menus', 'price', {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true // price can be null now
        }, options);

        await queryInterface.changeColumn('menus', 'slotId', {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'slots',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE' // deletion of a slot will cascade to menus
        }, options);
    });
}

export async function down({ context: queryInterface }) {
        const sequelize = queryInterface.sequelize;

    await sequelize.transaction(async transaction => {
        const options = { transaction };

        // Old schema required a price, so replace null values
        // before restoring the NOT NULL constraint.
        await sequelize.query(
            'UPDATE menus SET price = 0 WHERE price IS NULL',
            { transaction }
        );

        await queryInterface.changeColumn('menus', 'price', {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        }, options);

        await queryInterface.changeColumn('menus', 'slotId', {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'slots',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        }, options);
    });
}