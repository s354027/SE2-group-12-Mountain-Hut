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
            <span>{requirement.description}</span>
                        {requirement.isAllergy && (
              <span className="allergy-flag">Allergy</span>
            )}
          </div>
          {(onEdit || onRemove) && (
            <div className="party-requirement-actions">
              {onEdit && (
                <button
                  type="button"
                  className="btn requirement-edit-button d-flex align-items-center px-2"
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
                  className="btn btn-outline-danger d-flex align-items-center px-2"
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
