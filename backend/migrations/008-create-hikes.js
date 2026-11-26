import { DataTypes } from 'sequelize';

// MH-105 (Register a hike): hikes registered by a hiker before leaving,
// tracked by staff until they return (MH-91/MH-122, MH-92).
export async function up({ context: queryInterface }) {
    const sequelize = queryInterface.sequelize;

    await sequelize.transaction(async transaction => {
        const options = { transaction };

        await queryInterface.createTable('hikes', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            hikerId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            destination: {
                type: DataTypes.STRING,
                allowNull: false
            },
            route: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            waypoints: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            departureTime: {
                type: DataTypes.DATE,
                allowNull: false
            },
            expectedReturnTime: {
                type: DataTypes.DATE,
                allowNull: false
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'ONGOING'
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false
            }
        }, options);

        await queryInterface.addIndex(
            'hikes', ['status', 'expectedReturnTime'],
            { name: 'idx_hikes_status_expected_return', transaction }
        );
    });
}

export async function down({ context: queryInterface }) {
    const sequelize = queryInterface.sequelize;

    await sequelize.transaction(async transaction => {
        const options = { transaction };

        await queryInterface.dropTable('hikes', options);
    });
}
