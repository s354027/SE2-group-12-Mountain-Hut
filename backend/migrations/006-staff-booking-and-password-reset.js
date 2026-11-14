import { DataTypes } from 'sequelize';

// MH-07 (Reserve for a hiker):
// - temporary hikers created by an employee cannot log in (isTemporary)
// - full hikers created by an employee get a random password that must be
//   changed at the next login (mustChangePassword)
// - hikers can recover their password via an email link valid for 24 hours
export async function up({ context: queryInterface }) {
    const sequelize = queryInterface.sequelize;

    await sequelize.transaction(async transaction => {
        const options = { transaction };

        await queryInterface.addColumn('users', 'isTemporary', {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }, options);

        await queryInterface.addColumn('users', 'mustChangePassword', {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }, options);

        await queryInterface.createTable('password_reset_tokens', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            tokenHash: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            expiresAt: {
                type: DataTypes.DATE,
                allowNull: false
            },
            usedAt: {
                type: DataTypes.DATE,
                allowNull: true
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false
            }
        }, options);

        await queryInterface.addIndex(
            'password_reset_tokens', ['userId'],
            { name: 'idx_password_reset_tokens_user', transaction }
        );
    });
}

export async function down({ context: queryInterface }) {
    const sequelize = queryInterface.sequelize;

    await sequelize.transaction(async transaction => {
        const options = { transaction };

        await queryInterface.dropTable('password_reset_tokens', options);
        await queryInterface.removeColumn('users', 'mustChangePassword', options);
        await queryInterface.removeColumn('users', 'isTemporary', options);
    });
}
