/* eslint-disable no-unreachable */
/* eslint-disable consistent-return */
/* eslint-disable no-alert */
const reducerTwo = (state, action) => {
  switch (action.type) {
    case 'R2_DUMMY_ONE':
      alert('In Reducer two - dummy one');
      return { ...state, value: 'Data Two - Dummy One' };
      break;

    case 'R2_DUMMY_TWO':
      alert('In Reducer two - dummy two');
      return { ...state, value: 'Data Two - Dummy Two' };
      break;

    default:
      break;
  }
};

export default reducerTwo;
