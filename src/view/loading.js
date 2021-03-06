import AbstractView from './abstract';

const createLoadingTemplate = () => {
  return (
    `<p class="board__no-tasks">
      Loading...
    </p>`
  );
};

export default class Loading extends AbstractView {
  getTemplate() {
    return createLoadingTemplate();
  }
}
