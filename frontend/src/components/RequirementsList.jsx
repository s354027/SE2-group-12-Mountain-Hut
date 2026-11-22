export default function RequirementsList({
  onEdit,
  onRemove,
  partyRequirements,
}) {
  if (partyRequirements.length === 0) {
    return null;
  }

  return (
    <ul className="party-requirements">
      {partyRequirements.map((requirement, index) => (
        <li
          key={`${index}-${requirement.description}`}
          className="party-requirement"
        >
          <div className="party-requirement-details">
            <span
              className={`requirement-type-badge ${
                requirement.allergies ? "allergy-flag" : "diet-flag"
              }`}
            >
              {requirement.allergies ? "Allergy" : "Diet"}
            </span>
            <span className="requirement-description">
              {requirement.description}
            </span>
          </div>
          {(onEdit || onRemove) && (
            <div className="party-requirement-actions">
              {onEdit && (
                <button
                  type="button"
                  className="btn-edit d-flex align-items-center"
                  onClick={() => onEdit(index)}
                  aria-label={`Edit requirement: ${requirement.description}`}
                >
                  <span className="bi bi-pencil me-2" aria-hidden="true" />
                  Edit
                </button>
              )}
              {onRemove && (
                <button
                  type="button"
                  className="btn-delete d-flex align-items-center"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove requirement: ${requirement.description}`}
                >
                  <span className="bi bi-trash3-fill me-2" aria-hidden="true" />
                  Remove
                </button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
