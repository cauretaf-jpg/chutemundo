const model = window.ChuteDetailModel;
const originalEnsure = model.ensureMatchEvents;

model.ensureMatchEvents = function ensureEventsWithDiscipline(match, homeId, awayId) {
  const previousCards = Array.isArray(match.cards) ? match.cards.map((card) => ({ ...card })) : [];
  const result = originalEnsure(match, homeId, awayId);
  result.cards = (result.cards || []).map((card, index) => {
    const previous = previousCards.find((item) => item.id && item.id === card.id) || previousCards[index] || {};
    const isDoubleYellow = previous.reason === 'double_yellow' || previous.secondYellow === true || previous.type === 'second_yellow_red';
    return {
      ...previous,
      ...card,
      type: isDoubleYellow ? 'red' : card.type,
      reason: previous.reason || card.reason || '',
      secondYellow: Boolean(isDoubleYellow || card.secondYellow),
      createdAt: previous.createdAt || card.createdAt || null
    };
  });
  return result;
};

window.ChuteCardMetadataV56 = { ready: true };
