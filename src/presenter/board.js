import BoardView from '../view/board';
import SortView from '../view/sort';
import TaskListView from '../view/task-list';
import NoTaskView from '../view/no-task';
import LoadingView from '../view/loading';
import TaskPresenter, {State as TaskPresenterViewState} from '../presenter/task';
import TaskNewPresenter from '../presenter/task-new';
import LoadMoreButtonView from '../view/load-more-button';
import {render, remove, RenderPosition} from '../utils/render';
import {SortType, UserAction, UpdateType} from '../const';
import {filter} from '../utils/filter';
import {sortTasksDown, sortTasksUp} from '../utils/task';

const TASK_AMOUNT_PER_STEP = 8;

export default class Board {
  constructor(boardContainer, filterModel, tasksModel, api) {
    this._boardContainer = boardContainer;
    this._tasksModel = tasksModel;
    this._filterModel = filterModel;
    this._api = api;
    this._renderedTasksCount = TASK_AMOUNT_PER_STEP;
    this._currentSortType = SortType.DEFAULT;
    this._taskPresenter = {};
    this._isLoading = true;

    this._sortComponent = null;
    this._loadMoreButtonComponent = null;

    this._boardComponent = new BoardView();
    this._taskListComponent = new TaskListView();
    this._noTaskComponent = new NoTaskView();
    this._loadingComponent = new LoadingView();

    this._handleLoadMoreButtonClick = this._handleLoadMoreButtonClick.bind(this);
    this._handleSortTypeChange = this._handleSortTypeChange.bind(this);
    this._handleViewAction = this._handleViewAction.bind(this);
    this._handleModelEvent = this._handleModelEvent.bind(this);
    this._handleModeChange = this._handleModeChange.bind(this);

    this._taskNewPresenter = new TaskNewPresenter(this._taskListComponent, this._handleViewAction);
  }

  init() {
    render(this._boardContainer, this._boardComponent, RenderPosition.BEFOREEND);
    render(this._boardComponent, this._taskListComponent, RenderPosition.BEFOREEND);

    this._tasksModel.addObserver(this._handleModelEvent);
    this._filterModel.addObserver(this._handleModelEvent);

    this._renderBoard();
  }

  destroy() {
    this._clearBoard({resetRenderedTaskCount: true, resetSortType: true});

    remove(this._taskListComponent);
    remove(this._boardComponent);

    this._tasksModel.removeObserver(this._handleModelEvent);
    this._filterModel.removeObserver(this._handleModelEvent);
  }

  createTask(callback) {
    this._taskNewPresenter.init(callback);
  }

  _getTasks() {
    const filterType = this._filterModel.getFilter();
    const tasks = this._tasksModel.getTasks();
    const filtredTasks = filter[filterType](tasks);

    switch (this._currentSortType) {
      case SortType.DATE_UP:
        return filtredTasks.sort(sortTasksUp);
      case SortType.DATE_DOWN:
        return filtredTasks.sort(sortTasksDown);
    }

    return filtredTasks;
  }

  _handleModeChange() {
    this._taskNewPresenter.destroy();
    Object
      .values(this._taskPresenter)
      .forEach((presenter) => presenter.resetView());
  }

  _handleViewAction(actionType, updateType, update) {
    switch (actionType) {
      case UserAction.UPDATE_TASK:
        this._taskPresenter[update.id].setViewState(TaskPresenterViewState.SAVING);
        this._api.updateTask(update)
          .then((response) => this._tasksModel.updateTask(updateType, response))
          .catch(() => this._taskPresenter[update.id].setViewState(TaskPresenterViewState.ABORTING));
        break;
      case UserAction.ADD_TASK:
        this._taskNewPresenter.setSaving();
        this._api.addTask(update)
          .then((response) => this._tasksModel.addTask(updateType, response))
          .catch(() => this._taskNewPresenter.setAborting());
        break;
      case UserAction.DELETE_TASK:
        this._taskPresenter[update.id].setViewState(TaskPresenterViewState.DELETING);
        this._api.deleteTask(update)
          .then(() => this._tasksModel.deleteTask(updateType, update))
          .catch(() => this._taskPresenter[update.id].setViewState(TaskPresenterViewState.ABORTING));
        break;
    }
  }

  _handleModelEvent(updateType, data) {
    switch (updateType) {
      case UpdateType.PATCH:
        this._taskPresenter[data.id].init(data);
        break;
      case UpdateType.MINOR:
        this._clearBoard();
        this._renderBoard();
        break;
      case UpdateType.MAJOR:
        this._clearBoard({resetRenderedTaskCount: true, resetSortType: true});
        this._renderBoard();
        break;
      case UpdateType.INIT:
        this._isLoading = false;
        remove(this._loadingComponent);
        this._renderBoard();
        break;
    }
  }

  _handleSortTypeChange(sortType) {
    if (this._currentSortType === sortType) {
      return;
    }

    this._currentSortType = sortType;
    this._clearBoard({resetRenderedTaskCount: true});
    this._renderBoard();
  }

  _renderSort() {
    if (this._sortComponent !== null) {
      this._sortComponent = null;
    }

    this._sortComponent = new SortView(this._currentSortType);
    this._sortComponent.setSortTypeChangeHandler(this._handleSortTypeChange);
    render(this._boardComponent, this._sortComponent, RenderPosition.AFTERBEGIN);
  }

  _renderTask(task) {
    const taskPresenter = new TaskPresenter(this._taskListComponent, this._handleViewAction, this._handleModeChange);
    taskPresenter.init(task);
    this._taskPresenter[task.id] = taskPresenter;
  }

  _renderTasks(tasks) {
    tasks.forEach((task) => this._renderTask(task));
  }

  _renderLoading() {
    render(this._boardComponent, this._loadingComponent, RenderPosition.AFTERBEGIN);
  }

  _renderNoTasks() {
    render(this._boardComponent, this._noTaskComponent, RenderPosition.AFTERBEGIN);
  }

  _handleLoadMoreButtonClick() {
    const taskCount = this._getTasks().length;
    const newRenderedTaskCount = Math.min(taskCount, this._renderedTasksCount + TASK_AMOUNT_PER_STEP);
    const tasks = this._getTasks().slice(this._renderedTasksCount, newRenderedTaskCount);

    this._renderTasks(tasks);
    this._renderedTasksCount = newRenderedTaskCount;

    if (this._renderedTasksCount >= taskCount) {
      remove(this._loadMoreButtonComponent);
    }
  }

  _renderLoadMoreButton() {
    if (this._loadMoreButtonComponent !== null) {
      this._loadMoreButtonComponent = null;
    }

    this._loadMoreButtonComponent = new LoadMoreButtonView();
    this._loadMoreButtonComponent.setClickHandler(this._handleLoadMoreButtonClick);
    render(this._boardComponent, this._loadMoreButtonComponent, RenderPosition.BEFOREEND);
  }

  _clearBoard({resetRenderedTaskCount = false, resetSortType = false} = {}) {
    const taskCount = this._getTasks().length;

    this._taskNewPresenter.destroy();
    Object
      .values(this._taskPresenter)
      .forEach((presenter) => presenter.destroy());
    this._taskPresenter = {};

    remove(this._sortComponent);
    remove(this._noTaskComponent);
    remove(this._loadingComponent);
    remove(this._loadMoreButtonComponent);

    if (resetRenderedTaskCount) {
      this._renderedTasksCount = TASK_AMOUNT_PER_STEP;
    } else {
      this._renderedTasksCount = Math.min(taskCount, this._renderedTasksCount);
    }

    if (resetSortType) {
      this._currentSortType = SortType.DEFAULT;
    }
  }

  _renderBoard() {
    if (this._isLoading) {
      this._renderLoading();
      return;
    }

    const tasks = this._getTasks();
    const taskCount = this._getTasks().length;


    if (taskCount === 0) {
      this._renderNoTasks();
      return;
    }

    this._renderSort();
    this._renderTasks(tasks.slice(0, Math.min(taskCount, this._renderedTasksCount)));

    if (taskCount > this._renderedTasksCount) {
      this._renderLoadMoreButton();
    }
  }
}
