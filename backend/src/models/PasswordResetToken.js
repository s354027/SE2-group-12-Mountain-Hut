/* class with sequelize */
import { DataTypes } from 'sequelize';

// Single-use password recovery token (MH-07): only the SHA-256 hash of the
// token is stored, the plain token travels only inside the email link.
export function definePasswordResetToken(sequelize) {
    return sequelize.define('PasswordResetToken', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
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
        }
    }, {
        tableName: 'password_reset_tokens',
        timestamps: true,
        updatedAt: false
    });
}
